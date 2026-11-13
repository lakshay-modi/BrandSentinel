import { z } from "zod";
import { fail, json, readJson, roleSchema } from "@/lib/api";
import { db } from "@/lib/db";
import { isManager, withSession } from "@/lib/session";
import { newInviteToken } from "@/lib/workspaces";

const bodySchema = z.object({ role: roleSchema, note: z.string().trim().max(80).default("") });

/**
 * Invite one person with a role. The answer holds the invite link once; only a fingerprint of it is stored,
 * so it can't be read back later. The link works for 7 days and for one person.
 */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail(me.workspace.isDemo ? "The demo workspace is open to everyone, so it has no invites. Create your own workspace to invite a team." : "Only a brand manager can invite people.", 403);
  const { count } = await db().from("invites").select("id", { count: "exact", head: true }).eq("workspace_id", me.workspace.id).is("used_at", null);
  if ((count ?? 0) >= 25) return fail("There are 25 open invites already. Cancel some first.", 409);
  const { token, hash } = newInviteToken();
  const { data, error } = await db()
    .from("invites")
    .insert({ workspace_id: me.workspace.id, role: body.data.role, note: body.data.note, token_hash: hash, created_by: me.userId, created_by_name: me.name })
    .select("id, role, note, created_by_name, created_at, expires_at, used_at, used_by_name")
    .single();
  if (error) throw new Error(error.message);
  const origin = new URL(req.url).origin;
  return json({ invite: data, link: `${origin}/join/${token}` });
}, "workspace/invites");
