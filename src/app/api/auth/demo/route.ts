import { z } from "zod";
import { allow, clientId, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { DEMO_WORKSPACE } from "@/lib/db";
import { forgetMemberships, setSessionCookies, setWorkspaceCookie, signInDemoAccount } from "@/lib/session";

const bodySchema = z.object({ role: roleSchema });

/** "Try as Creator / Expert reviewer / Brand manager": signs straight into a ready-made demo account. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (!allow("demo-signin", clientId(req), 20, 60_000)) return fail("Too many sign-ins. Wait a minute and try again.", 429);
  try {
    const tokens = await signInDemoAccount(body.data.role);
    await setSessionCookies(tokens);
    await setWorkspaceCookie(DEMO_WORKSPACE);
    forgetMemberships(tokens.user?.id);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "auth/demo");
  }
}
