import { z } from "zod";
import { actorSchema, fail, json, readJson, ROLE_LABEL, roleSchema } from "@/lib/api";
import { addHistory, db } from "@/lib/db";
import { needsExpert } from "@/lib/review/score";
import type { Finding } from "@/lib/types";

const bodySchema = z.object({
  action: z.enum(["submit", "approve", "request_changes", "confirm_goal"]),
  role: roleSchema,
  actor: actorSchema,
  comment: z.string().trim().max(1000).optional(),
  goal: z.object({ post_type: z.string().max(60), message: z.string().max(300), call_to_action: z.string().max(120) }).optional(),
});

/** Move a post through the approval workflow. Only the person it's assigned to can approve or send it back. */
export async function POST(req: Request, ctx: RouteContext<"/api/posts/[id]/action">) {
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { action, role, actor, comment, goal } = body.data;

  try {
    const { data: post } = await db().from("posts").select("*").eq("id", id).maybeSingle();
    if (!post) return fail("Post not found", 404);
    const now = new Date().toISOString();

    if (action === "confirm_goal") {
      if (!goal) return fail("Send the goal to confirm");
      await db().from("posts").update({ goal, goal_confirmed: true, updated_at: now }).eq("id", id);
      await addHistory(id, "confirmed goal", role, actor, goal);
      return json({ ok: true });
    }

    if (action === "submit") {
      if (role !== "creator") return fail("Only the creator submits a post for review.", 403);
      if (post.status !== "draft" && post.status !== "changes_requested") return fail("This post has already been submitted.", 409);
      const { data: review } = await db().from("reviews").select("id, findings").eq("post_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!review) return fail("Check the post before submitting it.", 409);
      const { data: decisions } = await db().from("decisions").select("finding_id, action").eq("post_id", id).eq("review_id", review.id);
      const disputed = (decisions ?? []).some((d) => d.action === "disagree");
      const expert = needsExpert(review.findings as Finding[], new Set(), disputed);
      const assigned = expert ? "expert" : "brand_manager";
      await db().from("posts").update({ status: "in_review", needs_expert: expert, expert_approved: false, assigned_role: assigned, updated_at: now }).eq("id", id);
      await addHistory(id, "submitted", role, actor, {
        sent_to: ROLE_LABEL[assigned],
        why: expert ? (disputed ? "The creator disagreed with a finding." : "It has open claim or high-severity problems.") : "No open claims or serious problems.",
        comment,
      });
      return json({ ok: true, assigned_role: assigned });
    }

    // approve / request_changes
    if (post.status !== "in_review") return fail("This post isn't waiting for review.", 409);
    if (role !== post.assigned_role) return fail(`This post is waiting for the ${ROLE_LABEL[post.assigned_role as keyof typeof ROLE_LABEL] ?? "reviewer"}. Switch role to act on it.`, 403);

    if (action === "request_changes") {
      if (!comment || comment.length < 3) return fail("Tell the creator what to change.");
      await db().from("posts").update({ status: "changes_requested", assigned_role: null, expert_approved: false, updated_at: now }).eq("id", id);
      await addHistory(id, "requested changes", role, actor, { comment });
      return json({ ok: true });
    }

    if (role === "expert") {
      await db().from("posts").update({ expert_approved: true, assigned_role: "brand_manager", updated_at: now }).eq("id", id);
      await addHistory(id, "expert approved", role, actor, { comment, next: "Brand manager" });
      return json({ ok: true, assigned_role: "brand_manager" });
    }
    if (post.needs_expert && !post.expert_approved) return fail("The expert reviewer must approve first.", 409);
    await db().from("posts").update({ status: "approved", assigned_role: null, updated_at: now }).eq("id", id);
    await addHistory(id, "approved", role, actor, { comment });
    return json({ ok: true, status: "approved" });
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500);
  }
}
