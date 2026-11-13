import { z } from "zod";
import { allow, clientId, fail, json, readJson, serverError } from "@/lib/api";
import { AuthError, DEMO_ACCOUNTS, DEMO_PASSWORD, forgetMemberships, passwordSignIn, setSessionCookies, signInDemoAccount } from "@/lib/session";
import type { Role } from "@/lib/types";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200), password: z.string().min(1, "Enter your password").max(200) });

/** Sign in with email and password. The session is kept in cookies that only this server can read. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!allow("signin", clientId(req), 10, 60_000)) return fail("Too many sign-in attempts. Wait a minute and try again.", 429);
  const { email, password } = body.data;
  try {
    // the published demo accounts are created on first use
    const demoRole = (Object.keys(DEMO_ACCOUNTS) as Role[]).find((r) => DEMO_ACCOUNTS[r].email === email);
    const tokens = demoRole && password === DEMO_PASSWORD ? await signInDemoAccount(demoRole) : await passwordSignIn(email, password);
    await setSessionCookies(tokens);
    forgetMemberships(tokens.user?.id);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError && e.status < 500) return fail("That email and password don't match an account.", 401);
    return serverError(e, "auth/signin");
  }
}
