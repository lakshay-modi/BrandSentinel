// API tokens: how the browser extension, the Google Docs add-on and a scheduling tool prove which workspace
// they act for. A token is shown once when it is created; only its fingerprint is stored.
import "server-only";
import { randomBytes } from "node:crypto";
import { adminDb, DEMO_WORKSPACE } from "./db";
import { sha256 } from "./secrets";

/** The open demo's token: published on the Connect page, so anyone can try the extension and the add-on. */
export const DEMO_TOKEN = "bs_demo_public_token";

export function newToken(): { token: string; hash: string; hint: string } {
  const token = `bs_${randomBytes(27).toString("base64url")}`;
  return { token, hash: sha256(token), hint: `bs_…${token.slice(-4)}` };
}

export interface TokenScope {
  workspaceId: string;
  workspace: string;
  isDemo: boolean;
  tokenName: string;
}

/** Which workspace a request's "Authorization: Bearer …" token belongs to, or null. */
export async function tokenScope(req: Request): Promise<TokenScope | null> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(bs_[A-Za-z0-9_-]{10,80})$/);
  if (!m) return null;
  if (m[1] === DEMO_TOKEN) return { workspaceId: DEMO_WORKSPACE, workspace: "BrandSentinel demo", isDemo: true, tokenName: "Demo" };
  const { data } = await adminDb().from("api_tokens").select("id, name, workspace_id, workspaces(name, is_demo)").eq("token_hash", sha256(m[1])).maybeSingle();
  if (!data) return null;
  void adminDb().from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => undefined);
  const ws = data.workspaces as unknown as { name: string; is_demo: boolean } | null;
  return { workspaceId: data.workspace_id as string, workspace: ws?.name ?? "", isDemo: !!ws?.is_demo, tokenName: data.name as string };
}

/** Other websites and tools may call the public API: it is protected by the token, not by where the call comes from. */
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { ...CORS, "cache-control": "no-store" } });
}
