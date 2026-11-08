import { z } from "zod";
import { actorSchema, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { addHistory, db } from "@/lib/db";

const bodySchema = z
  .object({
    review_id: z.string().uuid(),
    finding_id: z.string().max(80),
    rule_id: z.string().max(20),
    action: z.enum(["accept", "edit", "disagree"]),
    reason: z.string().trim().max(500).optional(),
    role: roleSchema,
    actor: actorSchema,
  })
  .refine((b) => b.action !== "disagree" || (b.reason && b.reason.length >= 3), { message: "Say why you disagree (a few words is enough)", path: ["reason"] });

/** Record a human decision on one finding: accept the fix, edit it, or disagree with a reason. */
export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/decision">) {
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const b = body.data;
  try {
    if (b.role !== "creator") return fail("Only the creator accepts, edits or disagrees with findings.", 403);
    const { data: post } = await db().from("posts").select("status").eq("id", id).maybeSingle();
    if (!post) return fail("Post not found", 404);
    if (post.status !== "draft" && post.status !== "changes_requested") return fail("This post is in review or approved, so its findings can't change.", 409);
    // the decision must be about this post's latest check
    const { data: latest } = await db().from("reviews").select("id").eq("post_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!latest || latest.id !== b.review_id) return fail("The post was re-checked. Reload to see the latest findings.", 409);
    const { data, error } = await db()
      .from("decisions")
      .insert({ post_id: id, review_id: b.review_id, finding_id: b.finding_id, rule_id: b.rule_id, action: b.action, reason: b.reason ?? null, role: b.role, actor: b.actor })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await addHistory(id, b.action === "disagree" ? "disagreed" : b.action === "edit" ? "edited fix" : "accepted fix", b.role, b.actor, {
      finding: b.finding_id,
      rule: b.rule_id,
      reason: b.reason,
    });
    return json({ decision: data });
  } catch (e) {
    return serverError(e, "posts/[id]/decision");
  }
}
