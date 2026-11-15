import { crossSite, fail, json } from "@/lib/api";
import { clearSessionCookies } from "@/lib/session";

/** Sign out: the session cookies are removed. Works with or without a body, so a plain POST is enough. */
export async function POST(req: Request) {
  if (crossSite(req)) return fail("Requests must come from the BrandSentinel site.", 403);
  await clearSessionCookies();
  return json({ ok: true });
}
