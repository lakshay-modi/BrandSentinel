// Server-side database access. The Supabase key never reaches the browser.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Fact, Rule } from "./types";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
