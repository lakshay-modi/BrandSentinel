import { connection } from "next/server";
import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { aiKeyInfo, canStoreSecrets } from "@/lib/secrets";
import { forgetMemberships, isManager, withSession } from "@/lib/session";

/** The workspace's people, its open invites and where its AI key comes from. */
export const GET = withSession(async (_req, _ctx, me) => {
  await connection();
  const manager = isManager(me);
  const [members, invites, ai] = await Promise.all([
    db().from("workspace_members").select("user_id, role, name, email, created_at").eq("workspace_id", me.workspace.id).neq("role", "guest").order("created_at"),
    manager
      ? db().from("invites").select("id, role, note, created_by_name, created_at, expires_at, used_at, used_by_name").eq("workspace_id", me.workspace.id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    aiKeyInfo(me.workspace.id),
  ]);
  if (members.error) throw new Error(members.error.message);
  return json({
    workspace: me.workspace,
    you: { user_id: me.userId, role: me.memberRole, signed_in: me.signedIn, demo_account: me.demoAccount },
    can_manage: manager,
    members: (members.data ?? []).map((m) => ({ ...m, you: m.user_id === me.userId })),
    invites: invites.data ?? [],
    ai: { source: ai.source, hint: ai.hint, unreadable: !!ai.unreadable, can_store: canStoreSecrets() },
  });
}, "workspace");

/** Rename the workspace (brand manager). */
export const PATCH = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, z.object({ name: z.string().trim().min(2, "Give the workspace a name").max(80) }));
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail(me.workspace.isDemo ? "The demo workspace can't be renamed." : "Only a brand manager can rename the workspace.", 403);
  const { data, error } = await db().from("workspaces").update({ name: body.data.name }).eq("id", me.workspace.id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail("The workspace wasn't found.", 404);
  forgetMemberships();
  return json({ ok: true });
}, "workspace");
