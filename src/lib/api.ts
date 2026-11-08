import "server-only";
import { z } from "zod";
import type { Role } from "./types";

export const ROLES = ["creator", "brand_manager", "expert"] as const;
export const roleSchema = z.enum(ROLES);

export const ROLE_LABEL: Record<Role, string> = { creator: "Creator", brand_manager: "Brand manager", expert: "Expert reviewer" };

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const analysisSchema = z.object({
  ocr_text: z.string().max(4000).default(""),
  lines: z
    .array(z.object({ text: z.string().max(500), contrast: z.number().min(1).max(21), fg: hex, bg: hex, large: z.boolean() }))
    .max(40)
    .default([]),
  dominant: z.array(z.object({ hex, share: z.number().min(0).max(1) })).max(10).default([]),
  ocr_error: z.string().max(300).optional(),
});

// Images are stored as downscaled data URLs, or point at the bundled demo images. Nothing else is accepted,
// so a post can't make the server or other visitors' browsers load an outside address.
const imageSrc = z
  .string()
  .max(600_000)
  .regex(/^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*|\/demo\/[a-z0-9_-]+\.(?:png|jpe?g|webp))$/, "Images must be PNG, JPEG or WebP");

export const postInputSchema = z.object({
  title: z.string().max(200).optional(),
  channel: z.enum(["instagram", "linkedin", "x", "website", "email"]).default("instagram"),
  post_type: z.string().max(60).default("product"),
  product: z.string().max(120).default(""),
  partner: z.boolean().default(false),
  caption: z.string().min(1, "Write a caption first").max(3000),
  images: z
    .array(
      z.object({
        src: imageSrc,
        alt_text: z.string().max(500).default(""),
        analysis: analysisSchema.optional(),
      }),
    )
    .max(5)
    .default([]),
});

// a display name only (no sign-in in the demo): letters, numbers, spaces and simple punctuation
export const actorSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N} .'_-]+$/u, "Names can use letters, numbers, spaces, dots, dashes and apostrophes")
  .default("Guest");

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

/** Logs the real error on the server and returns a plain message, so database details never reach the browser. */
export function serverError(e: unknown, where: string) {
  console.error(`[${where}]`, e);
  return fail("Something went wrong on the server. Please try again.", 500);
}

export function clientId(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

/** Requests that change data must come from this site's own pages. */
function crossSite(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

// Simple per-visitor limit on writes (in memory per server instance; enough for a public demo).
const WRITE_LIMIT = 60;
const writes = new Map<string, number[]>();
function allowWrite(client: string, now = Date.now()): boolean {
  const recent = (writes.get(client) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= WRITE_LIMIT) return false;
  recent.push(now);
  writes.set(client, recent);
  if (writes.size > 5000) writes.clear();
  return true;
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  if (crossSite(req)) return { ok: false, res: fail("Requests must come from the BrandSentinel site.", 403) };
  if (!req.headers.get("content-type")?.includes("application/json")) return { ok: false, res: fail("Send JSON (content-type: application/json).", 415) };
  if (!allowWrite(clientId(req))) return { ok: false, res: fail("Too many changes in a minute. Wait a moment and try again.", 429) };
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: fail("Request body must be JSON") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, res: fail(parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ")) };
  return { ok: true, data: parsed.data };
}
