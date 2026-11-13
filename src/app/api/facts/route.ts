import { withSession } from "@/lib/session";
import { z } from "zod";
import { can, whoCan } from "@/lib/roles";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db, getBrandContext } from "@/lib/db";
import { factFields } from "@/lib/schemas";


const bodySchema = z.object({ role: roleSchema, actor: actorSchema, fact: factFields });

/** Add an approved fact (brand manager or expert reviewer). Every fact needs a source and an end date. */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  const { role, fact } = body.data;
  if (!can(role, "manage_facts")) return fail(`Only ${whoCan("manage_facts")} can add approved facts.`, 403);
  try {
    const { brand, facts } = await getBrandContext();
    const n = Math.max(0, ...facts.map((f) => Number(f.id.split("-")[1]) || 0)) + 1;
    const id = `F-${String(n).padStart(2, "0")}`;
    const { data, error } = await db().from("facts").insert({ ...fact, id, brand_id: brand.id }).select("*").single();
    if (error) throw new Error(error.message);
    return json({ fact: data });
  } catch (e) {
    return serverError(e, "facts");
  }
}, "facts");
