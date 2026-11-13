import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { isManager, withSession } from "@/lib/session";

/** Cancel an invite: its link stops working. */
export const DELETE = withSession<RouteContext<"/api/workspace/invites/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid invite", 400);
  if (!isManager(me)) return fail("Only a brand manager can cancel invites.", 403);
  const { data, error } = await db().from("invites").delete().eq("workspace_id", me.workspace.id).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail("That invite is already gone.", 404);
  return json({ ok: true });
}, "workspace/invites/[id]");
