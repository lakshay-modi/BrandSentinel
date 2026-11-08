// Server-side database access. The Supabase key never reaches the browser.
import "server-only";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Fact, Rule } from "./types";

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

export function db(): SupabaseClient {
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

export const DEMO_BRAND = "oatvia";
export const BRAND_COOKIE = "bs-brand";

/** The brand this visitor is working on (chosen in the header, kept in a cookie). Falls back to the demo brand. */
export async function currentBrandSlug(): Promise<string> {
  try {
    const v = (await cookies()).get(BRAND_COOKIE)?.value;
    if (v && /^[a-z0-9-]{1,40}$/.test(v)) return v;
  } catch {
    /* outside a request */
  }
  return DEMO_BRAND;
}

export async function listBrands(): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await db().from("brands").select("slug, name").order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface BrandContext {
  brand: Brand;
  rules: Rule[];
  facts: Fact[];
}

/** The brand a post belongs to, whatever brand the visitor has selected. */
export async function getBrandContextForBrandId(brandId: string): Promise<BrandContext> {
  const { data } = await db().from("brands").select("slug").eq("id", brandId).maybeSingle();
  if (!data) throw new Error(`Brand not found: ${brandId}`);
  return getBrandContext(data.slug as string);
}

export async function getBrandContext(slug?: string): Promise<BrandContext> {
  const wanted = slug ?? (await currentBrandSlug());
  let { data: brand } = await db().from("brands").select("id, slug, name, settings, rulebook_version").eq("slug", wanted).maybeSingle();
  if (!brand && wanted !== DEMO_BRAND) ({ data: brand } = await db().from("brands").select("id, slug, name, settings, rulebook_version").eq("slug", DEMO_BRAND).maybeSingle());
  if (!brand) throw new Error(`Brand not found: ${wanted}`);
  const [rules, facts] = await Promise.all([
    db().from("rules").select("id, category, severity, check_type, scope, rule, guideline, good, bad, params, status, version, source").eq("brand_id", brand.id).order("id"),
    db().from("facts").select("id, product, fact, source, valid_until, type").eq("brand_id", brand.id).order("id"),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  if (facts.error) throw new Error(facts.error.message);
  return { brand: brand as Brand, rules: (rules.data ?? []) as Rule[], facts: (facts.data ?? []) as Fact[] };
}

export async function getCache<T>(key: string): Promise<T | null> {
  const { data } = await db().from("ai_cache").select("result").eq("key", key).maybeSingle();
  return (data?.result as T) ?? null;
}

export async function setCache(key: string, result: unknown): Promise<void> {
  await db().from("ai_cache").upsert({ key, result });
}

export async function addHistory(postId: string, action: string, role: string, actor: string, detail: Record<string, unknown> = {}) {
  await db().from("history").insert({ post_id: postId, action, role, actor, detail });
}
