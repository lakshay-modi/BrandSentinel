import { z } from "zod";
import { allow, clientId, fail, json, readJson } from "@/lib/api";
import { adminDb } from "@/lib/db";
import { checkHookUrl, isSlackHook, newHookSecret } from "@/lib/hooks";
import { canStoreSecrets, encryptSecret } from "@/lib/secrets";
import { isManager, withSession } from "@/lib/session";

const bodySchema = z.object({
  kind: z.enum(["webhook", "slack"]),
  /** the address to send to; empty removes it */
  url: z.string().trim().max(500),
});

/**
 * Set or remove the workspace's webhook address or Slack hook (brand manager).
 * Addresses are encrypted before they are stored. A new webhook gets a signing secret, shown once.
 */
export const PUT = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail(me.workspace.isDemo ? "The shared demo sends nothing outside. Create your own workspace to connect a webhook or Slack." : "Only a brand manager can change connections.", 403);
  if (!canStoreSecrets()) return fail("This server can't store addresses safely (no server secret is set).", 503);
  if (!allow("hooks", clientId(req), 20, 10 * 60_000)) return fail("Too many changes. Wait a few minutes.", 429);
  const { kind, url } = body.data;
  const stamp = { workspace_id: me.workspace.id, updated_by: me.name, updated_at: new Date().toISOString() };

  if (!url) {
    const cleared = kind === "webhook" ? { webhook_url_enc: null, webhook_host: null, webhook_secret_enc: null } : { slack_url_enc: null, slack_hint: null };
    const { error } = await adminDb().from("workspace_secrets").upsert({ ...stamp, ...cleared });
    if (error) throw new Error(error.message);
    return json({ ok: true, removed: true });
  }

  if (kind === "slack") {
    if (!isSlackHook(url)) return fail("That isn't a Slack incoming webhook address. It starts with https://hooks.slack.com/services/", 400);
    const { error } = await adminDb().from("workspace_secrets").upsert({ ...stamp, slack_url_enc: encryptSecret(url), slack_hint: `…${url.slice(-4)}` });
    if (error) throw new Error(error.message);
    return json({ ok: true });
  }

  const checked = await checkHookUrl(url);
  if (!checked.ok) return fail(checked.reason, 400);
  const secret = newHookSecret();
  const { error } = await adminDb().from("workspace_secrets").upsert({ ...stamp, webhook_url_enc: encryptSecret(checked.url.toString()), webhook_host: checked.url.hostname, webhook_secret_enc: encryptSecret(secret) });
  if (error) throw new Error(error.message);
  return json({ ok: true, host: checked.url.hostname, secret });
}, "workspace/hooks");
