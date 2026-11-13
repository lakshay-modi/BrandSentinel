import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { setWorkspaceCookie, withSession } from "@/lib/session";

/** Work in another of your workspaces. */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, z.object({ workspace_id: z.string().uuid() }));
  if (!body.ok) return body.res;
  if (!me.memberships.some((m) => m.workspace_id === body.data.workspace_id)) return fail("You are not in that workspace.", 403);
  await setWorkspaceCookie(body.data.workspace_id);
  return json({ ok: true });
}, "workspace/switch");
