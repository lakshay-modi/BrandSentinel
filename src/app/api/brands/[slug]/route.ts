import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db } from "@/lib/db";
import { can, whoCan } from "@/lib/roles";
import { brandFields } from "@/lib/schemas";

async function find(slug: string) {
  const { data } = await db().from("brands").select("id, slug, name, settings").eq("slug", slug).maybeSingle();
  return data;
}

/** One brand's editable details. */
export async function GET(_req: Request, ctx: RouteContext<"/api/brands/[slug]">) {
  const { slug } = await ctx.params;
  try {
    const b = await find(slug);
    if (!b) return fail("Brand not found", 404);
    const s = b.settings ?? {};
    return json({
      brand: {
        slug: b.slug,
        name: b.name,
        protected: !!s.protected,
        tagline: s.tagline ?? "",
        products: s.products ?? [],
        product_misspellings: s.product_misspellings ?? [],
        brand_hashtag: s.brand_hashtag ?? "",
        confidential_terms: s.confidential_terms ?? [],
        palette: s.palette ?? [],
      },
    });
  } catch (e) {
    return serverError(e, "brands/[slug]");
  }
}

const patchSchema = z.object({ role: roleSchema, actor: actorSchema, brand: brandFields });

/** Edit a brand's details (brand manager). Sample posts and other settings are kept. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/brands/[slug]">) {
  const { slug } = await ctx.params;
  const body = await readJson(req, patchSchema);
  if (!body.ok) return body.res;
  const { role, brand } = body.data;
  if (!can(role, "manage_brands")) return fail(`Only ${whoCan("manage_brands")} can edit brands.`, 403);
  try {
    const b = await find(slug);
    if (!b) return fail("Brand not found", 404);
    const settings = { ...(b.settings ?? {}), ...brand };
    const { error } = await db().from("brands").update({ name: brand.name, settings }).eq("id", b.id);
    if (error) throw new Error(error.message);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "brands/[slug]");
  }
}

const deleteSchema = z.object({ role: roleSchema, actor: actorSchema, confirm: z.string().trim().max(60) });

/** Delete a brand with all its rulebooks, facts and posts (brand manager, after typing its name). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/brands/[slug]">) {
  const { slug } = await ctx.params;
  const body = await readJson(req, deleteSchema);
  if (!body.ok) return body.res;
  const { role, confirm } = body.data;
  if (!can(role, "manage_brands")) return fail(`Only ${whoCan("manage_brands")} can delete brands.`, 403);
  try {
    const b = await find(slug);
    if (!b) return fail("Brand not found", 404);
    if (b.settings?.protected) return fail("This is one of the demo brands, so it can't be deleted.", 409);
    if (confirm !== b.name) return fail(`Type the brand's name (${b.name}) to confirm.`, 400);
    const { error } = await db().from("brands").delete().eq("id", b.id);
    if (error) throw new Error(error.message);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "brands/[slug]");
  }
}
