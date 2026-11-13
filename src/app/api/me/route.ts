import { connection } from "next/server";
import { json, serverError } from "@/lib/api";
import { getSession, NoWorkspaceError } from "@/lib/session";

/** Who the visitor is: signed in or not, their workspace and the role they hold there. */
export async function GET() {
  await connection();
  try {
    const me = await getSession();
    return json({
      signed_in: me.signedIn,
      demo_account: me.demoAccount,
      name: me.signedIn ? me.name : null,
      email: me.signedIn ? me.email : null,
      workspace: me.workspace,
      // "guest" means the role can be switched on screen (the public demo)
      role: me.memberRole,
      workspaces: me.signedIn ? me.memberships.map((m) => ({ id: m.workspace_id, name: m.workspace, is_demo: m.is_demo, role: m.role })) : [],
    });
  } catch (e) {
    if (e instanceof NoWorkspaceError) return json({ signed_in: true, demo_account: false, name: null, email: e.email, workspace: null, role: null, workspaces: [] });
    return serverError(e, "me");
  }
}
