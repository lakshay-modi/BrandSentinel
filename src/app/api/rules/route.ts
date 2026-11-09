import { z } from "zod";
import { can, whoCan } from "@/lib/roles";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db, getBrandContext } from "@/lib/db";

const PREFIX = { tone: "TONE", words: "WORD", claims: "CLAIM", visuals: "VIS", readability: "READ" } as const;

const bodySchema = z.object({
  role: roleSchema,
  actor: actorSchema,
  rule: z.object({
    category: z.enum(["tone", "words", "claims", "visuals", "readability"]),
    severity: z.enum(["high", "medium", "low"]),
    scope: z.string().trim().max(120).default("all"),
    rule: z.string().trim().min(5).max(300),
    guideline: z.string().trim().max(1500).default(""),
    good: z.string().trim().max(300).default(""),
    bad: z.string().trim().max(300).default(""),
    status: z.enum(["approved", "draft"]).default("approved"),
  }),
});

/** Add a rule. New rules are checked by the AI (fast checks need code), and every change creates a new rulebook version. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { role, rule } = body.data;
  if (!can(role, "manage_rules")) return fail(`Only ${whoCan("manage_rules")} can change the Rulebook.`, 403);
  try {
    const { brand, rules } = await getBrandContext();
    const prefix = PREFIX[rule.category];
    const n = Math.max(0, ...rules.filter((r) => r.id.startsWith(prefix + "-")).map((r) => Number(r.id.split("-")[1]) || 0)) + 1;
    const id = `${prefix}-${String(n).padStart(2, "0")}`;
    const { data, error } = await db()
      .from("rules")
      .insert({ ...rule, id, brand_id: brand.id, check_type: "ai", params: {} })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await db().from("brands").update({ rulebook_version: brand.rulebook_version + 1 }).eq("id", brand.id);
    return json({ rule: data, rulebook_version: brand.rulebook_version + 1 });
  } catch (e) {
    return serverError(e, "rules");
  }
}
