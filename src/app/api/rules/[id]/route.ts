import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db, getBrandContext } from "@/lib/db";

const bodySchema = z.object({
  role: roleSchema,
  actor: actorSchema,
  changes: z
    .object({
      severity: z.enum(["high", "medium", "low"]),
      scope: z.string().trim().max(120),
      rule: z.string().trim().min(5).max(300),
      guideline: z.string().trim().max(1500),
      good: z.string().trim().max(300),
      bad: z.string().trim().max(300),
      status: z.enum(["approved", "draft", "rejected"]),
    })
    .partial(),
});

/** Edit or approve a rule (brand manager only). Bumps the rule's version and the rulebook version. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/rules/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { role, changes } = body.data;
  if (role !== "brand_manager") return fail("Only the brand manager can change the Rulebook.", 403);
  try {
    const { brand, rules } = await getBrandContext();
    const current = rules.find((r) => r.id === id);
    if (!current) return fail("Rule not found", 404);
    const { data, error } = await db()
      .from("rules")
      .update({ ...changes, version: current.version + 1, updated_at: new Date().toISOString() })
      .eq("brand_id", brand.id)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await db().from("brands").update({ rulebook_version: brand.rulebook_version + 1 }).eq("id", brand.id);
    return json({ rule: data, rulebook_version: brand.rulebook_version + 1 });
  } catch (e) {
    return serverError(e, "rules/[id]");
  }
}
