import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { adminDb, db } from "@/lib/db";
import { isManager, withSession } from "@/lib/session";
import { newInviteToken } from "@/lib/workspaces";

/**
 * A one-time link that lets this member choose a new password, for 24 hours (brand manager).
 * No email is sent: the manager passes the link on. Only a fingerprint of it is stored.
 */
export const POST = withSession<RouteContext<"/api/workspace/members/[id]/reset">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid member", 400);
  if (!isManager(me)) return fail(me.workspace.isDemo ? "The demo accounts' password is public and fixed, so they have no reset links." : "Only a brand manager can create password reset links.", 403);
  // the person must be in this workspace (the database's row rules decide what this manager can see)
  const { data: member } = await db().from("workspace_members").select("user_id, name").eq("workspace_id", me.workspace.id).eq("user_id", id).maybeSingle();
  if (!member) return fail("That person isn't in this workspace.", 404);
  const { token, hash } = newInviteToken();
  const admin = adminDb();
  // an older unused link for the same person stops working
  await admin.from("password_resets").delete().eq("user_id", id).is("used_at", null);
  const { error } = await admin.from("password_resets").insert({ token_hash: hash, user_id: id, workspace_id: me.workspace.id, created_by: me.userId });
  if (error) throw new Error(error.message);
  return json({ link: `${new URL(req.url).origin}/reset/${token}`, name: member.name });
}, "workspace/members/[id]/reset");
