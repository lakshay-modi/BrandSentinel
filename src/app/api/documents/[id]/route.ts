import { withSession } from "@/lib/session";
import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { bumpRulebook, db, getBrandRow } from "@/lib/db";
import { can, whoCan } from "@/lib/roles";

const patchSchema = z.object({
  role: roleSchema,
  actor: actorSchema,
  changes: z.object({ name: z.string().trim().min(2).max(80), status: z.enum(["active", "paused"]) }).partial(),
});

/** Rename a rulebook, or pause and resume it: a paused rulebook's rules leave the checks. */
export const PATCH = withSession<RouteContext<"/api/documents/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, patchSchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  const { role, changes } = body.data;
  if (!can(role, "manage_rules")) return fail(`Only ${whoCan("manage_rules")} can change rulebooks.`, 403);
  try {
    const brand = await getBrandRow();
    const { data, error } = await db().from("guideline_docs").update(changes).eq("brand_id", brand.id).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail("Rulebook not found in this brand", 404);
    if (changes.status) await bumpRulebook(brand);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "documents/[id]");
  }
}, "documents/[id]");

const deleteSchema = z.object({ role: roleSchema, actor: actorSchema });

/** Remove a rulebook and every rule that came from it (for example after uploading the wrong PDF). */
export const DELETE = withSession<RouteContext<"/api/documents/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, deleteSchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  if (!can(body.data.role, "manage_rules")) return fail(`Only ${whoCan("manage_rules")} can remove rulebooks.`, 403);
  try {
    const brand = await getBrandRow();
    const { data, error } = await db().from("guideline_docs").delete().eq("brand_id", brand.id).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail("Rulebook not found in this brand", 404);
    await bumpRulebook(brand);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "documents/[id]");
  }
}, "documents/[id]");
