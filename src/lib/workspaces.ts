// Joining and starting workspaces: used by sign-up and by people who are already signed in.
import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "./db";
import { slugify } from "./schemas";
import { sha256 } from "./secrets";
import { addStarterRules } from "./starter-rules";

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: sha256(token) };
}

export const INVITE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export interface InviteInfo {
  workspace: string;
  role: "creator" | "expert" | "brand_manager";
  invited_by: string;
  state: "open" | "used" | "expired";
}

/** What an invite link leads to, or null when the link isn't real. */
export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  if (!INVITE_TOKEN.test(token)) return null;
  const { data, error } = await adminDb().rpc("invite_info", { p_token_hash: sha256(token) });
  if (error) throw new Error(error.message);
  return (data as InviteInfo | null) ?? null;
}

/** Postgres raises plain sentences for the cases a person can fix ("This invite link has expired"). */
export function plainDbMessage(message: string): string | null {
  return /^(This invite|You are already|You have reached|Give the workspace|Demo accounts)/.test(message) ? message : null;
}

/** Start a workspace as its brand manager, with a first brand so every page has something to show. */
export async function createWorkspace(client: SupabaseClient, name: string, memberName: string, email: string): Promise<string> {
  const { data: id, error } = await client.rpc("create_workspace", { p_name: name, p_member_name: memberName, p_email: email });
  if (error || !id) throw new Error(error?.message ?? "Could not create the workspace");
  const settings = { name, tagline: "", palette: [], palette_tolerance: 40, products: [], product_misspellings: [], brand_hashtag: "", confidential_terms: [] };
  const { data: brand, error: bErr } = await client.from("brands").insert({ workspace_id: id, slug: slugify(name), name, settings }).select("id").single();
  if (bErr || !brand) console.error("[workspaces] could not create the first brand", bErr?.message);
  // common rules, so the first check already finds problems; the manager can edit or remove them
  else await addStarterRules(client, brand.id as string, memberName);
  return id as string;
}

export async function acceptInvite(client: SupabaseClient, token: string, memberName: string, email: string): Promise<string> {
  const { data: id, error } = await client.rpc("accept_invite", { p_token_hash: sha256(token), p_member_name: memberName, p_email: email });
  if (error || !id) throw new Error(error?.message ?? "Could not join the workspace");
  return id as string;
}
