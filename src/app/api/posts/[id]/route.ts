import { withSession } from "@/lib/session";
import { db, getBrandContextForBrandId } from "@/lib/db";
import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { can } from "@/lib/roles";

/** One post with its latest review, every human decision and the full history. */
export const GET = withSession<RouteContext<"/api/posts/[id]">>(async (_req, ctx) => {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid post id", 400);
  try {
    const [post, review, decisions, history] = await Promise.all([
      db().from("posts").select("*").eq("id", id).maybeSingle(),
      db().from("reviews").select("*").eq("post_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db().from("decisions").select("*").eq("post_id", id).order("created_at", { ascending: true }),
      db().from("history").select("*").eq("post_id", id).order("created_at", { ascending: true }),
    ]);
    if (!post.data) return fail("Post not found", 404);
    // the post's own brand: its facts prove its findings even when another brand is selected in the header
    const ctx = await getBrandContextForBrandId(post.data.brand_id);
    return json({
      post: post.data,
      review: review.data,
      decisions: decisions.data ?? [],
      history: history.data ?? [],
      brand: { slug: ctx.brand.slug, name: ctx.brand.name },
      facts: ctx.facts,
    });
  } catch (e) {
    return serverError(e, "posts/[id]");
  }
}, "posts/[id]");

const deleteSchema = z.object({ role: roleSchema, actor: actorSchema });

/**
 * Delete a draft (the creator only). Posts in review or approved are kept for the record.
 * Its checks, decisions and history go with it. A demo brand's sample comes back with "Reset demo".
 */
export const DELETE = withSession<RouteContext<"/api/posts/[id]">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Invalid post id", 400);
  const body = await readJson(req, deleteSchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  if (!can(body.data.role, "check_posts")) return fail("Only the creator can delete drafts.", 403);
  try {
    const { data: post } = await db().from("posts").select("status").eq("id", id).maybeSingle();
    if (!post) return fail("Post not found", 404);
    if (post.status !== "draft" && post.status !== "changes_requested")
      return fail("Only drafts and posts sent back can be deleted. Posts in review or approved are kept for the record.", 409);
    const { error } = await db().from("posts").delete().eq("id", id).in("status", ["draft", "changes_requested"]);
    if (error) throw new Error(error.message);
    return json({ ok: true });
  } catch (e) {
    return serverError(e, "posts/[id]");
  }
}, "posts/[id]");
