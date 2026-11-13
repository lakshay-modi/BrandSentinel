// Server-side database access. The Supabase key never reaches the browser.
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Fact, GuidelineDoc, Rule } from "./types";

let client: SupabaseClient | null = null;

/**
 * The server prefers its own Supabase secret key (BRANDSENTINEL_DB_KEY). With it, the database can refuse
 * all direct public access, so every change has to go through this app's API and its checks.
 * A dedicated name is used on purpose: hosting integrations may set SUPABASE_SECRET_KEY for a different project.
 * If the database rejects the secret key (wrong project, typo), requests fall back to the publishable key
 * instead of taking the site down, and the health check reports it.
 */
let secretRejected = false;
let rejectReason = "";

/** What kind of server key is set and why the database refused it, without revealing the key. */
export function dbKeyDiagnostics() {
  const k = process.env.BRANDSENTINEL_DB_KEY?.trim() ?? "";
  if (!k) return null;
  const kind = k.startsWith("sb_secret_") ? "secret key (sb_secret_)" : k.startsWith("sb_publishable_") ? "publishable key, not a secret key" : k.startsWith("eyJ") ? "legacy JWT key" : "unknown format";
  let jwtProject: string | undefined;
  let jwtRole: string | undefined;
  if (k.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString());
      jwtProject = payload.ref; // project refs are public (they are in the project URL)
      jwtRole = payload.role;
    } catch {
      /* not a readable JWT */
    }
  }
  const urlProject = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  return { kind, length: k.length, url_project: urlProject, jwt_project: jwtProject, jwt_role: jwtRole, rejected_because: rejectReason || undefined };
}

export function dbAccessMode(): "secret key" | "publishable key" | "publishable key (secret key rejected)" {
  if (!process.env.BRANDSENTINEL_DB_KEY) return "publishable key";
  return secretRejected ? "publishable key (secret key rejected)" : "secret key";
}

/** fetch for supabase-js: try the secret key; on "invalid API key" switch to the publishable key for good. */
function fallbackFetch(secret: string, publishable: string | undefined): typeof fetch {
  const withKey = (init: RequestInit | undefined, key: string): RequestInit => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", key);
    if (headers.get("authorization")?.toLowerCase().startsWith("bearer ")) headers.set("authorization", `Bearer ${key}`);
    return { ...init, headers };
  };
  return async (input, init) => {
    if (!secretRejected || !publishable) {
      const res = await fetch(input, secretRejected ? init : withKey(init, secret));
      if (res.status !== 401 || !publishable || secretRejected) return res;
      secretRejected = true;
      rejectReason = (await res.clone().text().catch(() => "")).slice(0, 160);
      console.error("[db] BRANDSENTINEL_DB_KEY was rejected by the database; using the publishable key instead.", rejectReason);
    }
    return fetch(input, withKey(init, publishable!));
  };
}

/**
 * The server's own client (secret key). It bypasses the database's row rules, so it is used only for the few jobs
 * that are not done on someone's behalf: creating accounts, the AI answer cache, workspace secrets, Reset demo.
 */
export function adminDb(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const secret = process.env.BRANDSENTINEL_DB_KEY?.trim();
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
    const key = secret || publishable;
    if (!url || !key) throw new Error("SUPABASE_URL and BRANDSENTINEL_DB_KEY (or SUPABASE_PUBLISHABLE_KEY) must be set");
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(secret && publishable ? { global: { fetch: fallbackFetch(secret, publishable) } } : {}),
    });
  }
  return client;
}

/** What a request carries: the database client that acts AS the person, and their workspace. */
export interface RequestScope {
  db: SupabaseClient;
  workspaceId: string;
  /** the workspace's own AI key, once a route has asked for it */
  aiKey?: string | null;
}
export const requestScope = new AsyncLocalStorage<RequestScope>();

/**
 * The database as the current person sees it. Every query runs with their own session token, so Postgres
 * row level security returns and changes only their workspace's rows.
 */
export function db(): SupabaseClient {
  const scope = requestScope.getStore();
  if (!scope) throw new Error("db() was called outside a request with a session (wrap the route in withSession)");
  return scope.db;
}

export function currentWorkspaceId(): string {
  const scope = requestScope.getStore();
  if (!scope) throw new Error("No session for this request");
  return scope.workspaceId;
}

/** A client that sends this person's session token: the database applies its row rules to it. */
export function userDb(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.BRANDSENTINEL_DB_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and BRANDSENTINEL_DB_KEY (or SUPABASE_PUBLISHABLE_KEY) must be set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const DEMO_WORKSPACE = "00000000-0000-4000-8000-000000000001";
export const BRAND_COOKIE = "bs-brand";

/** The brand this visitor is working on (chosen in the header, kept in a cookie), if they chose one. */
export async function currentBrandSlug(): Promise<string | null> {
  try {
    const v = (await cookies()).get(BRAND_COOKIE)?.value;
    if (v && /^[a-z0-9-]{1,40}$/.test(v)) return v;
  } catch {
    /* outside a request */
  }
  return null;
}

/** A workspace with no brands yet: the app asks the brand manager to create the first one. */
export class NoBrandError extends Error {
  constructor() {
    super("This workspace has no brands yet. A brand manager can create one under Manage brands.");
    this.name = "NoBrandError";
  }
}

export async function listBrands(): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await db().from("brands").select("slug, name").eq("workspace_id", currentWorkspaceId()).order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Bump the brand's rulebook version so cached AI answers made with the old rules are not reused. */
export async function bumpRulebook(brand: Brand) {
  await db().from("brands").update({ rulebook_version: brand.rulebook_version + 1 }).eq("id", brand.id);
}

export interface BrandContext {
  brand: Brand;
  rules: Rule[];
  facts: Fact[];
  documents: GuidelineDoc[];
}

/** The brand a post belongs to, whatever brand the visitor has selected. */
export async function getBrandContextForBrandId(brandId: string): Promise<BrandContext> {
  const { data } = await db().from("brands").select("slug, workspace_id").eq("id", brandId).maybeSingle();
  if (!data || data.workspace_id !== currentWorkspaceId()) throw new NoBrandError();
  return getBrandContext(data.slug as string);
}

/** Just the selected brand's row: one query, for edits that don't need the whole rulebook. */
export async function getBrandRow(slug?: string): Promise<Brand> {
  const wanted = slug ?? (await currentBrandSlug());
  const ws = currentWorkspaceId();
  const cols = "id, slug, name, settings, rulebook_version";
  if (wanted) {
    const { data: brand } = await db().from("brands").select(cols).eq("workspace_id", ws).eq("slug", wanted).maybeSingle();
    if (brand) return brand as Brand;
  }
  // nothing chosen yet (or the chosen brand is gone): the workspace's first brand
  const { data: first, error } = await db().from("brands").select(cols).eq("workspace_id", ws).order("created_at").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!first) throw new NoBrandError();
  return first as Brand;
}

export async function getBrandContext(slug?: string): Promise<BrandContext> {
  const brand = await getBrandRow(slug);
  const [rules, facts, docs] = await Promise.all([
    db().from("rules").select("id, category, severity, check_type, scope, rule, guideline, good, bad, params, status, version, source, document_id").eq("brand_id", brand.id).order("id"),
    db().from("facts").select("id, product, fact, source, valid_until, type").eq("brand_id", brand.id).order("id"),
    db().from("guideline_docs").select("id, name, file_name, kind, status, created_by, created_at").eq("brand_id", brand.id).order("created_at"),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  if (facts.error) throw new Error(facts.error.message);
  if (docs.error) throw new Error(docs.error.message);
  const documents = (docs.data ?? []) as GuidelineDoc[];
  const paused = new Set(documents.filter((d) => d.status === "paused").map((d) => d.id));
  // rules of a paused rulebook leave the checks: they are marked "paused" here and never stored that way
  const allRules = ((rules.data ?? []) as Rule[]).map((r) => (r.status === "approved" && r.document_id && paused.has(r.document_id) ? { ...r, status: "paused" as const } : r));
  return { brand, rules: allRules, facts: (facts.data ?? []) as Fact[], documents };
}

export async function getCache<T>(key: string): Promise<T | null> {
  const { data } = await adminDb().from("ai_cache").select("result").eq("key", key).maybeSingle();
  return (data?.result as T) ?? null;
}

export async function setCache(key: string, result: unknown): Promise<void> {
  await adminDb().from("ai_cache").upsert({ key, result });
}

export async function addHistory(postId: string, action: string, role: string, actor: string, detail: Record<string, unknown> = {}) {
  await db().from("history").insert({ post_id: postId, action, role, actor, detail });
}
