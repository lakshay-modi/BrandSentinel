import { z } from "zod";

export const factFields = z.object({
  product: z.string().trim().min(2).max(120),
  fact: z.string().trim().min(3).max(400),
  source: z.string().trim().min(2).max(160),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-31"),
  type: z.enum(["nutrition", "allergen", "diet", "origin", "environment", "price", "availability", "offer", "company", "restriction", "general"]).default("general"),
});

const shortList = (max: number, each: number) => z.array(z.string().trim().min(1).max(each)).max(max).default([]);

/** Brand details a brand manager can set when creating or editing a brand. */
export const brandFields = z.object({
  name: z.string().trim().min(2, "Give the brand a name").max(60),
  tagline: z.string().trim().max(120).default(""),
  products: shortList(20, 60),
  product_misspellings: shortList(20, 60),
  brand_hashtag: z
    .string()
    .trim()
    .max(40)
    .regex(/^(#[\p{L}\p{N}_]+)?$/u, "A hashtag starts with # and has no spaces")
    .default(""),
  confidential_terms: shortList(20, 60),
  palette: z
    .array(z.object({ name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours look like #1F2A44"), use: z.string().trim().max(80).default("") }))
    .max(8)
    .default([]),
});
export type BrandFields = z.infer<typeof brandFields>;

/** "Oatvia Foods!" → "oatvia-foods" */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "brand"
  );
}
