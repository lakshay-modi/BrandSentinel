import { z } from "zod";
import { json, readJson } from "@/lib/api";
import { clearSessionCookies } from "@/lib/session";

/** Sign out: the session cookies are removed. The visitor is back in the public demo. */
export async function POST(req: Request) {
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  await clearSessionCookies();
  return json({ ok: true });
}
