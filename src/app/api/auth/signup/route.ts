import { z } from "zod";
import { actorSchema, allow, clientId, fail, json, readJson, serverError } from "@/lib/api";
import { adminDb, userDb } from "@/lib/db";
import { DEMO_DOMAIN, forgetMemberships, passwordSignIn, setSessionCookies, setWorkspaceCookie } from "@/lib/session";
import { acceptInvite, createWorkspace, INVITE_TOKEN, inviteInfo, plainDbMessage } from "@/lib/workspaces";

const bodySchema = z
  .object({
    name: actorSchema.refine((n) => n !== "Guest", "Enter your name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
    /** start a new company workspace … */
    workspace: z.string().trim().min(2, "Give your workspace a name").max(80).optional(),
    /** … or join one with an invite link */
    invite: z.string().regex(INVITE_TOKEN).optional(),
  })
  .refine((b) => !!b.workspace !== !!b.invite, "Name a new workspace or use an invite link");

/**
 * Create an account. No confirmation email is sent (the free plan has no mail budget), so the account works
 * at once; the person then starts a workspace as its brand manager, or joins one through an invite link.
 */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!allow("signup", clientId(req), 6, 60 * 60_000)) return fail("Too many new accounts from here. Try again in an hour.", 429);
  const { name, email, password, workspace, invite } = body.data;
  if (email.endsWith(`@${DEMO_DOMAIN}`)) return fail("That address is reserved for the demo accounts.", 400);
  if (!process.env.BRANDSENTINEL_DB_KEY) return fail("Sign-up isn't set up on this server (it needs the database's secret key).", 503);

  try {
    if (invite) {
      const info = await inviteInfo(invite);
      if (!info) return fail("This invite link is not valid.", 404);
      if (info.state !== "open") return fail(info.state === "used" ? "This invite link has already been used." : "This invite link has expired. Ask for a new one.", 409);
    }
    const { data, error } = await adminDb().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
    if (error || !data.user) {
      const msg = error?.message ?? "";
      if (/already|registered|exists/i.test(msg)) return fail("An account with this email already exists. Sign in instead.", 409);
      if (/password/i.test(msg)) return fail("Choose a stronger password (at least 8 characters).", 400);
      throw new Error(msg || "No user returned");
    }
    const tokens = await passwordSignIn(email, password);
    await setSessionCookies(tokens);
    const client = userDb(tokens.access_token);
    let workspaceId: string;
    try {
      workspaceId = invite ? await acceptInvite(client, invite, name, email) : await createWorkspace(client, workspace!, name, email);
    } catch (e) {
      const plain = e instanceof Error ? plainDbMessage(e.message) : null;
      // the account exists and is signed in; they can create a workspace from the welcome screen
      return json({ ok: true, needs_workspace: true, note: plain ?? "Your account was created, but the workspace wasn't. Try creating it again." });
    }
    await setWorkspaceCookie(workspaceId);
    forgetMemberships(data.user.id);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "auth/signup");
  }
}
