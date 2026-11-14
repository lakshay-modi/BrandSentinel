import { db } from "@/lib/db";
import { json } from "@/lib/api";
import { hookSettings } from "@/lib/hooks";
import { isManager, withSession } from "@/lib/session";
import { DEMO_TOKEN } from "@/lib/tokens";

/** Everything on the Connect page: API tokens, the webhook, Slack, and what was sent recently. */
export const GET = withSession(async (req, _ctx, me) => {
  const manager = isManager(me);
  const [tokens, deliveries, hooks, brands] = await Promise.all([
    manager ? db().from("api_tokens").select("id, name, hint, created_by_name, created_at, last_used_at").eq("workspace_id", me.workspace.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    db().from("hook_deliveries").select("id, kind, event, post_id, post_title, target, ok, status, ms, detail, created_at").eq("workspace_id", me.workspace.id).order("created_at", { ascending: false }).limit(20),
    manager ? hookSettings(me.workspace.id) : Promise.resolve(null),
    db().from("brands").select("slug, name").eq("workspace_id", me.workspace.id).order("created_at"),
  ]);
  return json({
    workspace: me.workspace,
    can_manage: manager,
    api_base: new URL(req.url).origin,
    // the open demo has one published token, so the extension and the add-on can be tried without an account
    demo_token: me.workspace.isDemo ? DEMO_TOKEN : null,
    brands: brands.data ?? [],
    tokens: tokens.data ?? [],
    webhook: hooks?.webhookUrl ? { host: new URL(hooks.webhookUrl).hostname, signed: !!hooks.webhookSecret } : null,
    slack: !!hooks?.slackUrl,
    deliveries: deliveries.data ?? [],
  });
}, "workspace/connections");
