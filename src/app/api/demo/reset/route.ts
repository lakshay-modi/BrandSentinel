import { withSession } from "@/lib/session";
import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { adminDb } from "@/lib/db";

const bodySchema = z.object({ role: roleSchema, actor: actorSchema });

// one reset at a time across visitors on this server, so repeated clicks don't pile up
let lastReset = 0;

/**
 * "Reset demo", for trying the app only: puts the two demo brands (their sample posts with checks and history,
 * rulebooks and facts) back as they were when the demo was set up. Posts people created themselves stay.
 */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  if (!me.workspace.isDemo) return fail("Reset demo is only for the demo workspace. Your own workspace is never reset.", 403);
  if (Date.now() - lastReset < 10_000) return fail("The demo was just reset. Try again in a few seconds.", 429);
  lastReset = Date.now();
  try {
    const { data, error } = await adminDb().rpc("reset_demo");
    if (error) throw new Error(error.message);
    console.info(`[demo/reset] by ${body.data.actor} (${body.data.role})`, data);
    return json({ ok: true, ...(data as { brands: number; posts: number }) });
  } catch (e) {
    lastReset = 0;
    return serverError(e, "demo/reset");
  }
}, "demo/reset");
