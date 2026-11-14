import { z } from "zod";
import { allow, clientId, fail, json, readJson } from "@/lib/api";
import { adminDb } from "@/lib/db";
import { AuthError, passwordSignIn, setSessionCookies, withSession } from "@/lib/session";

const bodySchema = z.object({ current: z.string().min(1, "Enter your current password").max(200), password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters") });

/** Change your own password: the current one is checked first. The demo accounts' password is fixed. */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (me.demoAccount) return fail("The demo accounts share one public password, so it can't be changed.", 403);
  if (!allow("password", clientId(req), 6, 10 * 60_000)) return fail("Too many tries. Wait a few minutes.", 429);
  if (body.data.current === body.data.password) return fail("The new password is the same as the current one.", 400);
  try {
    await passwordSignIn(me.email, body.data.current);
  } catch (e) {
    if (e instanceof AuthError && e.status < 500) return fail("Your current password isn't right.", 401);
    throw e;
  }
  const { error } = await adminDb().auth.admin.updateUserById(me.userId, { password: body.data.password });
  if (error) return fail(/password/i.test(error.message) ? "Choose a stronger password (at least 8 characters)." : "The password couldn't be changed. Try again.", 400);
  // a fresh session with the new password
  await setSessionCookies(await passwordSignIn(me.email, body.data.password));
  return json({ ok: true });
}, "auth/password");
