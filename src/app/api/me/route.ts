import { connection } from "next/server";
import { json, serverError } from "@/lib/api";
import { getSession, NoWorkspaceError, NotSignedInError } from "@/lib/session";

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
      role: me.memberRole,
      // may act in any of the three roles (a brand manager covering for a small team)
      can_switch: me.canSwitchRole,
      workspaces: me.signedIn ? me.memberships.map((m) => ({ id: m.workspace_id, name: m.workspace, is_demo: m.is_demo, role: m.role })) : [],
    });
  } catch (e) {
    if (e instanceof NotSignedInError) return json({ signed_in: false, demo_account: false, name: null, email: null, workspace: null, role: null, can_switch: false, workspaces: [] });
    if (e instanceof NoWorkspaceError) return json({ signed_in: true, demo_account: false, name: null, email: e.email, workspace: null, role: null, can_switch: false, workspaces: [] });
    return serverError(e, "me");
  }
}
