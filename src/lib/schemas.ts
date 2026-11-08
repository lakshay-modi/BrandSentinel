import { z } from "zod";

export const factFields = z.object({
  product: z.string().trim().min(2).max(120),
  fact: z.string().trim().min(3).max(400),
  source: z.string().trim().min(2).max(160),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-31"),
  type: z.enum(["nutrition", "allergen", "diet", "origin", "environment", "price", "availability", "offer", "company", "restriction", "general"]).default("general"),
});
