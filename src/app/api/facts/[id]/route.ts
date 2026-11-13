import { withSession } from "@/lib/session";
import { z } from "zod";
import { can, whoCan } from "@/lib/roles";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db, getBrandRow } from "@/lib/db";
import { factFields } from "@/lib/schemas";

const bodySchema = z.object({ role: roleSchema, actor: actorSchema, changes: factFields.partial() });

/** Edit an approved fact, e.g. extend its end date or correct a number. */
export const PATCH = withSession<RouteContext<"/api/facts/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  const { role, changes } = body.data;
  if (!can(role, "manage_facts")) return fail(`Only ${whoCan("manage_facts")} can change approved facts.`, 403);
  try {
    const brand = await getBrandRow();
    const { data, error } = await db()
      .from("facts")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("brand_id", brand.id)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return json({ fact: data });
  } catch (e) {
    return serverError(e, "facts/[id]");
  }
}, "facts/[id]");

const deleteSchema = z.object({ role: roleSchema, actor: actorSchema });

/** Remove an approved fact (expert reviewer or brand manager). Claims that relied on it lose their proof. */
export const DELETE = withSession<RouteContext<"/api/facts/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, deleteSchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  if (!can(body.data.role, "manage_facts")) return fail(`Only ${whoCan("manage_facts")} can remove facts.`, 403);
  try {
    const brand = await getBrandRow();
    const { data, error } = await db().from("facts").delete().eq("brand_id", brand.id).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail("Fact not found", 404);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "facts/[id]");
  }
}, "facts/[id]");
