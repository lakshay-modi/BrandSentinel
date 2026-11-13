import { z } from "zod";
import { fail, json, readJson, roleSchema } from "@/lib/api";
import { db } from "@/lib/db";
import { forgetMemberships, isManager, withSession, type Session } from "@/lib/session";

/** A workspace always keeps at least one brand manager, or nobody could run it. */
async function lastManager(me: Session, userId: string): Promise<boolean> {
  const { data } = await db().from("workspace_members").select("user_id").eq("workspace_id", me.workspace.id).eq("role", "brand_manager");
  const managers = (data ?? []).map((m) => m.user_id as string);
  return managers.length === 1 && managers[0] === userId;
}

/** Change someone's role (brand manager). */
export const PATCH = withSession<RouteContext<"/api/workspace/members/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, z.object({ role: roleSchema }));
  if (!body.ok) return body.res;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid member", 400);
  if (!isManager(me)) return fail("Only a brand manager can change roles.", 403);
  if (body.data.role !== "brand_manager" && (await lastManager(me, id))) return fail("This is the only brand manager. Make someone else a brand manager first.", 409);
  const { data, error } = await db().from("workspace_members").update({ role: body.data.role }).eq("workspace_id", me.workspace.id).eq("user_id", id).select("user_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail("That person isn't in this workspace.", 404);
  forgetMemberships(id);
  return json({ ok: true });
}, "workspace/members/[id]");

/** Remove someone from the workspace (brand manager). Their posts and history stay. */
export const DELETE = withSession<RouteContext<"/api/workspace/members/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid member", 400);
  if (!isManager(me)) return fail("Only a brand manager can remove people.", 403);
  if (await lastManager(me, id)) return fail("This is the only brand manager, so they can't be removed.", 409);
  const { data, error } = await db().from("workspace_members").delete().eq("workspace_id", me.workspace.id).eq("user_id", id).select("user_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail("That person isn't in this workspace.", 404);
  forgetMemberships(id);
  return json({ ok: true });
}, "workspace/members/[id]");
