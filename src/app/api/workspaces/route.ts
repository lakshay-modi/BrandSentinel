import { z } from "zod";
import { allow, clientId, fail, json, readJson, serverError } from "@/lib/api";
import { userDb } from "@/lib/db";
import { forgetMemberships, getSession, NoWorkspaceError, setWorkspaceCookie } from "@/lib/session";
import { acceptInvite, createWorkspace, INVITE_TOKEN, plainDbMessage } from "@/lib/workspaces";

const bodySchema = z
  .object({ name: z.string().trim().min(2, "Give your workspace a name").max(80).optional(), invite: z.string().regex(INVITE_TOKEN).optional(), member_name: z.string().trim().max(40).optional() })
  .refine((b) => !!b.name !== !!b.invite, "Name a new workspace or use an invite link");

/** A signed-in person starts another workspace, or joins one with an invite link. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!allow("workspace-create", clientId(req), 10, 60 * 60_000)) return fail("Too many tries. Wait a while and try again.", 429);
  let who: { userId: string; email: string; name: string; client: ReturnType<typeof userDb>; demo: boolean };
  try {
    const me = await getSession();
    if (!me.signedIn) return fail("Sign in first.", 401);
    who = { userId: me.userId, email: me.email, name: me.name, client: me.db, demo: me.demoAccount };
  } catch (e) {
    if (!(e instanceof NoWorkspaceError)) return serverError(e, "workspaces (session)");
    who = { userId: e.userId, email: e.email, name: body.data.member_name || e.email.split("@")[0], client: userDb(e.token), demo: false };
  }
  if (who.demo) return fail("The demo accounts can't create or join workspaces. Create your own account to do that.", 403);
  try {
    const memberName = body.data.member_name || who.name;
    const id = body.data.invite ? await acceptInvite(who.client, body.data.invite, memberName, who.email) : await createWorkspace(who.client, body.data.name!, memberName, who.email);
    await setWorkspaceCookie(id);
    forgetMemberships(who.userId);
    return json({ ok: true, workspace_id: id });
  } catch (e) {
    const plain = e instanceof Error ? plainDbMessage(e.message) : null;
    if (plain) return fail(plain, 409);
    return serverError(e, "workspaces");
  }
}
