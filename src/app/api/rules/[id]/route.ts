import { z } from "zod";
import { can, whoCan } from "@/lib/roles";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { bumpRulebook, db, getBrandRow } from "@/lib/db";

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
  if (!can(role, "manage_rules")) return fail(`Only ${whoCan("manage_rules")} can change the Rulebook.`, 403);
  try {
    const brand = await getBrandRow();
    const { data: current } = await db().from("rules").select("version").eq("brand_id", brand.id).eq("id", id).maybeSingle();
    if (!current) return fail("Rule not found", 404);
    const { data, error } = await db()
      .from("rules")
      .update({ ...changes, version: current.version + 1, updated_at: new Date().toISOString() })
      .eq("brand_id", brand.id)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await bumpRulebook(brand);
    return json({ rule: data, rulebook_version: brand.rulebook_version + 1 });
  } catch (e) {
    return serverError(e, "rules/[id]");
  }
}

const deleteSchema = z.object({ role: roleSchema, actor: actorSchema });

/** Delete one rule (brand manager). Past reports keep their copy of it. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/rules/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(req, deleteSchema);
  if (!body.ok) return body.res;
  if (!can(body.data.role, "manage_rules")) return fail(`Only ${whoCan("manage_rules")} can delete rules.`, 403);
  try {
    const brand = await getBrandRow();
    const { data, error } = await db().from("rules").delete().eq("brand_id", brand.id).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail("Rule not found", 404);
    await bumpRulebook(brand);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "rules/[id]");
  }
}
