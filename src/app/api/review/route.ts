import { z } from "zod";
import { actorSchema, clientId, fail, json, postInputSchema, readJson, roleSchema, serverError } from "@/lib/api";
import { addHistory, db, getBrandContext, getBrandContextForBrandId, type BrandContext } from "@/lib/db";
import { runReview } from "@/lib/review/run-review";
import type { PostInput } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = z.object({
  post_id: z.string().uuid().optional(),
  sample_id: z.string().max(10).optional(),
  role: roleSchema.default("creator"),
  actor: actorSchema,
  input: postInputSchema,
});

/** Check a post: creates it (first check) or updates it (re-check), runs the review and saves the result. */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { post_id, sample_id, role, actor } = body.data;
  const input = body.data.input as PostInput;

  try {
    // a re-check uses the post's own brand; a new post uses the brand selected in the header
    let ctx: BrandContext | null = post_id ? null : await getBrandContext();
    const fields = {
      title: input.title ?? input.caption.slice(0, 60),
      channel: input.channel,
      post_type: input.post_type,
      product: input.product,
      partner: input.partner,
      caption: input.caption,
      images: input.images,
      updated_at: new Date().toISOString(),
    };

    let postId = post_id;
    if (postId) {
      if (role !== "creator") return fail("Only the creator changes and re-checks a post.", 403);
      const { data: existing } = await db().from("posts").select("id, status, brand_id").eq("id", postId).maybeSingle();
      if (!existing) return fail("Post not found", 404);
      ctx = await getBrandContextForBrandId(existing.brand_id);
      if (existing.status === "in_review" || existing.status === "approved")
        return fail(existing.status === "approved" ? "This post is already approved." : "This post is waiting for review, so it can't be changed right now.", 409);
      const { error } = await db().from("posts").update(fields).eq("id", postId);
      if (error) throw new Error(error.message);
    } else {
      if (!ctx) throw new Error("No brand selected");
      const { data, error } = await db()
        .from("posts")
        .insert({ ...fields, brand_id: ctx.brand.id, sample_id: sample_id ?? null, created_by: actor })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not save the post");
      postId = data.id as string;
      await addHistory(postId, "created", role, actor, { sample_id });
    }

    if (!ctx) throw new Error("No brand for this post");
    const origin = new URL(req.url).origin;
    const result = await runReview(input, ctx, { origin, clientId: clientId(req) });

    const { data: review, error: rErr } = await db()
      .from("reviews")
      .insert({
        post_id: postId,
        caption: input.caption,
        images: input.images.map((i) => ({ alt_text: i.alt_text, ocr_text: i.analysis?.ocr_text ?? "" })),
        score: result.score,
        band: result.band,
        findings: result.findings,
        ask_human: result.ask_human,
        goal: result.goal,
        suggested_caption: result.suggested_caption,
        dropped: result.dropped,
        redacted: result.redacted,
        rulebook_version: result.rulebook_version,
        model: result.model,
        ai_status: result.ai_status,
      })
      .select("id, created_at")
      .single();
    if (rErr || !review) throw new Error(rErr?.message ?? "Could not save the review");

    if (result.goal) await db().from("posts").update({ goal: result.goal }).eq("id", postId).eq("goal_confirmed", false);
    await addHistory(postId, post_id ? "re-checked" : "checked", role, actor, {
      score: result.score,
      problems: result.findings.length,
      ai: result.ai_status,
    });

    return json({ post_id: postId, review: { ...result, id: review.id, created_at: review.created_at } });
  } catch (e) {
    return serverError(e, "review");
  }
}
