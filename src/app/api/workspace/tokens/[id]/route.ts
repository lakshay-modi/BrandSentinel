import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { isManager, withSession } from "@/lib/session";

/** Delete a token: whatever used it stops working at once. */
export const DELETE = withSession<RouteContext<"/api/workspace/tokens/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid token", 400);
  if (!isManager(me)) return fail("Only a brand manager can delete tokens.", 403);
  const { data, error } = await db().from("api_tokens").delete().eq("workspace_id", me.workspace.id).eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail("That token is already gone.", 404);
  return json({ ok: true });
}, "workspace/tokens/[id]");
