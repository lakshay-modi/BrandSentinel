import { z } from "zod";
import { allow, clientId, fail, json, readJson, serverError } from "@/lib/api";
import { adminDb } from "@/lib/db";
import { sha256 } from "@/lib/secrets";
import { forgetMemberships, passwordSignIn, setSessionCookies, setWorkspaceCookie } from "@/lib/session";
import { INVITE_TOKEN } from "@/lib/workspaces";

const bodySchema = z.object({ token: z.string().regex(INVITE_TOKEN, "This reset link is not valid"), password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters") });

async function findReset(token: string) {
  const { data } = await adminDb().from("password_resets").select("id, user_id, workspace_id, expires_at, used_at").eq("token_hash", sha256(token)).maybeSingle();
  if (!data) return { error: "This reset link is not valid. Ask your brand manager for a new one." };
  if (data.used_at) return { error: "This reset link has already been used. Ask your brand manager for a new one." };
  if (new Date(data.expires_at as string).getTime() < Date.now()) return { error: "This reset link has expired (they work for 24 hours). Ask your brand manager for a new one." };
  return { reset: data };
}

/** Is this reset link still usable? (shown before the person types a new password) */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!INVITE_TOKEN.test(token)) return fail("This reset link is not valid.", 404);
  try {
    const found = await findReset(token);
    if ("error" in found) return fail(found.error!, 410);
    const { data: user } = await adminDb().auth.admin.getUserById(found.reset.user_id as string);
    return json({ email: user.user?.email ?? null });
  } catch (e) {
    return serverError(e, "auth/reset");
  }
}

/** Set the new password, use up the link, and sign the person in. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!allow("reset", clientId(req), 10, 10 * 60_000)) return fail("Too many tries. Wait a few minutes.", 429);
  try {
    const found = await findReset(body.data.token);
    if ("error" in found) return fail(found.error!, 410);
    const admin = adminDb();
    // use the link up first, so it can't be used twice at the same moment
    const { data: claimed } = await admin.from("password_resets").update({ used_at: new Date().toISOString() }).eq("id", found.reset.id).is("used_at", null).select("id");
    if (!claimed?.length) return fail("This reset link has already been used.", 410);
    const { data: user, error } = await admin.auth.admin.updateUserById(found.reset.user_id as string, { password: body.data.password });
    if (error || !user.user?.email) return fail(/password/i.test(error?.message ?? "") ? "Choose a stronger password (at least 8 characters)." : "The password couldn't be changed. Ask for a new link.", 400);
    const tokens = await passwordSignIn(user.user.email, body.data.password);
    await setSessionCookies(tokens);
    await setWorkspaceCookie(found.reset.workspace_id as string);
    forgetMemberships(found.reset.user_id as string);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "auth/reset");
  }
}
