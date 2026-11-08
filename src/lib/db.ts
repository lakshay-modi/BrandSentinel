// Server-side database access. The Supabase key never reaches the browser.
import "server-only";
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
      console.error("[db] BRANDSENTINEL_DB_KEY was rejected by the database; using the publishable key instead.");
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

export interface BrandContext {
  brand: Brand;
  rules: Rule[];
  facts: Fact[];
}

export async function getBrandContext(slug = DEMO_BRAND): Promise<BrandContext> {
  const { data: brand, error } = await db().from("brands").select("id, slug, name, settings, rulebook_version").eq("slug", slug).single();
  if (error || !brand) throw new Error(`Brand not found: ${error?.message ?? slug}`);
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
