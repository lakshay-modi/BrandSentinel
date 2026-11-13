import { z } from "zod";
import { allow, clientId, fail, json, readJson } from "@/lib/api";
import { adminDb } from "@/lib/db";
import { canStoreSecrets, encryptSecret } from "@/lib/secrets";
import { isManager, withSession } from "@/lib/session";

const bodySchema = z.object({ key: z.string().trim().min(20, "That doesn't look like a Gemini API key").max(200).regex(/^[A-Za-z0-9_.-]+$/, "That doesn't look like a Gemini API key") });

/** Asks Google whether the key works, without spending any AI quota. */
async function keyWorks(key: string): Promise<"ok" | "invalid" | "unknown"> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) });
    if (res.ok) return "ok";
    return res.status === 400 || res.status === 401 || res.status === 403 ? "invalid" : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Connect the workspace's own Gemini API key (brand manager). From then on this workspace's AI checks use it,
 * under the company's own account and data terms. The key is encrypted and can't be read back, only replaced.
 */
export const PUT = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail(me.workspace.isDemo ? "The demo workspace uses BrandSentinel's shared key. Create your own workspace to connect your own." : "Only a brand manager can change the AI key.", 403);
  if (!canStoreSecrets()) return fail("This server can't store keys safely (no server secret is set).", 503);
  if (!allow("ai-key", clientId(req), 8, 10 * 60_000)) return fail("Too many tries. Wait a few minutes.", 429);
  const works = await keyWorks(body.data.key);
  if (works === "invalid") return fail("Google rejected that key. Check that it is a Gemini API key and that it is enabled.", 400);
  if (works === "unknown") return fail("Couldn't reach Google to check the key. Try again in a moment.", 502);
  const hint = `…${body.data.key.slice(-4)}`;
  const { error } = await adminDb()
    .from("workspace_secrets")
    .upsert({ workspace_id: me.workspace.id, ai_key_enc: encryptSecret(body.data.key), ai_key_hint: hint, updated_by: me.name, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return json({ ok: true, ai: { source: "own", hint } });
}, "workspace/ai-key");

/** Remove the workspace's own key: AI checks go back to the shared demo key. */
export const DELETE = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail("Only a brand manager can change the AI key.", 403);
  const { error } = await adminDb().from("workspace_secrets").update({ ai_key_enc: null, ai_key_hint: null, updated_by: me.name, updated_at: new Date().toISOString() }).eq("workspace_id", me.workspace.id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
}, "workspace/ai-key");
