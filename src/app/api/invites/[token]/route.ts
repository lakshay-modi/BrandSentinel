import { fail, json, serverError } from "@/lib/api";
import { inviteInfo } from "@/lib/workspaces";

/** What an invite link leads to (workspace name and role), shown before the person joins. */
export async function GET(_req: Request, ctx: RouteContext<"/api/invites/[token]">) {
  const { token } = await ctx.params;
  try {
    const info = await inviteInfo(token);
    if (!info) return fail("This invite link is not valid.", 404);
    return json({ invite: info });
  } catch (e) {
    return serverError(e, "invites/[token]");
  }
}
