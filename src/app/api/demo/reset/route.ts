import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db } from "@/lib/db";

const bodySchema = z.object({ role: roleSchema, actor: actorSchema });

// one reset at a time across visitors on this server, so repeated clicks don't pile up
let lastReset = 0;

/**
 * "Reset demo", for trying the app only: puts the two demo brands (their sample posts with checks and history,
 * rulebooks and facts) back as they were when the demo was set up. Posts people created themselves stay.
 */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  if (Date.now() - lastReset < 10_000) return fail("The demo was just reset. Try again in a few seconds.", 429);
  lastReset = Date.now();
  try {
    const { data, error } = await db().rpc("reset_demo");
    if (error) throw new Error(error.message);
    console.info(`[demo/reset] by ${body.data.actor} (${body.data.role})`, data);
    return json({ ok: true, ...(data as { brands: number; posts: number }) });
  } catch (e) {
    lastReset = 0;
    return serverError(e, "demo/reset");
  }
}
