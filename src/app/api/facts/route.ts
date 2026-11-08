import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema } from "@/lib/api";
import { db, getBrandContext } from "@/lib/db";
import { factFields } from "@/lib/schemas";


const bodySchema = z.object({ role: roleSchema, actor: actorSchema, fact: factFields });

/** Add an approved fact (brand manager or expert reviewer). Every fact needs a source and an end date. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { role, fact } = body.data;
  if (role === "creator") return fail("Only the brand manager or expert reviewer can add approved facts.", 403);
  try {
    const { brand, facts } = await getBrandContext();
    const n = Math.max(0, ...facts.map((f) => Number(f.id.split("-")[1]) || 0)) + 1;
    const id = `F-${String(n).padStart(2, "0")}`;
    const { data, error } = await db().from("facts").insert({ ...fact, id, brand_id: brand.id }).select("*").single();
    if (error) throw new Error(error.message);
    return json({ fact: data });
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500);
  }
}
