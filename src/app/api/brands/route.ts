import { withSession } from "@/lib/session";
import { connection } from "next/server";
import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { currentWorkspaceId, db } from "@/lib/db";
import { can, whoCan } from "@/lib/roles";
import { brandFields, slugify } from "@/lib/schemas";
import { addStarterRules } from "@/lib/starter-rules";

/** Every brand with what it holds: rules, facts, rulebooks and posts. */
export const GET = withSession(async () => {
  await connection();
  try {
    const [brands, rules, facts, posts, docs] = await Promise.all([
      db().from("brands").select("id, slug, name, settings, created_at").eq("workspace_id", currentWorkspaceId()).order("created_at"),
      db().from("rules").select("brand_id, status"),
      db().from("facts").select("brand_id"),
      db().from("posts").select("brand_id, status, updated_at"),
      db().from("guideline_docs").select("brand_id"),
    ]);
    if (brands.error) throw new Error(brands.error.message);
    const count = <T extends { brand_id: string }>(rows: T[] | null, id: string, fn: (r: T) => boolean = () => true) => (rows ?? []).filter((r) => r.brand_id === id && fn(r)).length;
    return json({
      brands: (brands.data ?? []).map((b) => {
        const last = (posts.data ?? []).filter((p) => p.brand_id === b.id).map((p) => p.updated_at as string).sort().at(-1) ?? null;
        return {
          slug: b.slug,
          name: b.name,
          tagline: b.settings?.tagline ?? "",
          palette: ((b.settings?.palette ?? []) as { hex: string; name: string }[]).slice(0, 8).map((c) => ({ hex: c.hex, name: c.name })),
          protected: !!b.settings?.protected,
          created_at: b.created_at,
          last_activity: last,
          rules: count(rules.data, b.id, (r) => r.status === "approved"),
          drafts: count(rules.data, b.id, (r) => r.status === "draft"),
          facts: count(facts.data, b.id),
          rulebooks: count(docs.data, b.id),
          posts: count(posts.data, b.id),
          waiting: count(posts.data, b.id, (p) => p.status === "in_review"),
        };
      }),
    });
  } catch (e) {
    return serverError(e, "brands");
  }
}, "brands");

const createSchema = z.object({ role: roleSchema, actor: actorSchema, brand: brandFields, starter_rules: z.boolean().default(false) });

/** Create a brand (brand manager). It starts with no rules, facts or posts. */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, createSchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  const { role, brand } = body.data;
  if (!can(role, "manage_brands")) return fail(`Only ${whoCan("manage_brands")} can create brands.`, 403);
  try {
    const { data: taken } = await db().from("brands").select("slug").eq("workspace_id", me.workspace.id);
    const used = new Set((taken ?? []).map((b) => b.slug as string));
    if ((taken ?? []).length >= 50) return fail("This workspace has reached its limit of 50 brands. Delete one first.", 409);
    const base = slugify(brand.name);
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    const settings = { ...brand, palette_tolerance: 40 };
    const { data, error } = await db().from("brands").insert({ slug, name: brand.name, settings, workspace_id: me.workspace.id }).select("id, slug, name").single();
    if (error) throw new Error(error.message);
    const starter = body.data.starter_rules ? await addStarterRules(db(), data.id as string, body.data.actor) : 0;
    return json({ brand: { slug: data.slug, name: data.name }, starter_rules: starter });
  } catch (e) {
    return serverError(e, "brands");
  }
}, "brands");
