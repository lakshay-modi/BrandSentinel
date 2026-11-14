import { z } from "zod";
import { allow, clientId, fail, json, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { notify } from "@/lib/hooks";
import { isManager, withSession } from "@/lib/session";

/** Send a test event to the webhook and a test message to Slack now, and report what came back. */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail("Only a brand manager can send a test.", 403);
  if (!allow("hooks-test", clientId(req), 10, 10 * 60_000)) return fail("Too many tests. Wait a few minutes.", 429);
  const before = new Date(Date.now() - 1000).toISOString();
  await notify(me.workspace, "test", null, new URL(req.url).origin);
  const { data } = await db().from("hook_deliveries").select("id, kind, event, post_id, post_title, target, ok, status, ms, detail, created_at").eq("workspace_id", me.workspace.id).gte("created_at", before).order("created_at", { ascending: false });
  if (!data?.length) return fail("Nothing is connected yet. Add a webhook address or a Slack hook first.", 409);
  return json({ deliveries: data });
}, "workspace/hooks/test");
