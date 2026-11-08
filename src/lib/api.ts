import "server-only";
import { z } from "zod";
import type { Role } from "./types";

export const ROLES = ["creator", "brand_manager", "expert"] as const;
export const roleSchema = z.enum(ROLES);

export const ROLE_LABEL: Record<Role, string> = { creator: "Creator", brand_manager: "Brand manager", expert: "Expert reviewer" };

const analysisSchema = z.object({
  ocr_text: z.string().max(4000).default(""),
  lines: z
    .array(z.object({ text: z.string().max(500), contrast: z.number(), fg: z.string().max(9), bg: z.string().max(9), large: z.boolean() }))
    .max(40)
    .default([]),
  dominant: z.array(z.object({ hex: z.string().max(9), share: z.number() })).max(10).default([]),
});

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
        src: z.string().max(600_000), // downscaled image as a data URL, or a /demo/ path
        alt_text: z.string().max(500).default(""),
        analysis: analysisSchema.optional(),
      }),
    )
    .max(5)
    .default([]),
});

export const actorSchema = z.string().trim().min(1).max(40).default("Guest");

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

export function clientId(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
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
