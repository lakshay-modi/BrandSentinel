import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db, getBrandContext } from "@/lib/db";
import { factFields } from "@/lib/schemas";

const bodySchema = z.object({ role: roleSchema, actor: actorSchema, changes: factFields.partial() });

/** Edit an approved fact, e.g. extend its end date or correct a number. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/facts/[id]">) {
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { role, changes } = body.data;
  if (role === "creator") return fail("Only the brand manager or expert reviewer can change approved facts.", 403);
  try {
    const { brand } = await getBrandContext();
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
}
