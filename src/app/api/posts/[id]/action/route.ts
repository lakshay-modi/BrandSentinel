import { withSession } from "@/lib/session";
import { z } from "zod";
import { actorSchema, fail, json, readJson, ROLE_LABEL, roleSchema, serverError } from "@/lib/api";
import { addHistory, db } from "@/lib/db";
import { can } from "@/lib/roles";
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
export const POST = withSession<RouteContext<"/api/posts/[id]/action">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  body.data.role = me.role(body.data.role);
  body.data.actor = me.actor(body.data.actor);
  const { action, role, actor, comment, goal } = body.data;

  try {
    const { data: post } = await db().from("posts").select("*").eq("id", id).maybeSingle();
    if (!post) return fail("Post not found", 404);
    const now = new Date().toISOString();

    if (action === "confirm_goal") {
      if (!can(role, "check_posts")) return fail("Only the creator confirms the post's goal.", 403);
      if (post.status !== "draft" && post.status !== "changes_requested") return fail("The goal can't change while the post is in review or approved.", 409);
      if (!goal) return fail("Send the goal to confirm");
      await Promise.all([db().from("posts").update({ goal, goal_confirmed: true, updated_at: now }).eq("id", id), addHistory(id, "confirmed goal", role, actor, goal)]);
      return json({ ok: true });
    }

    if (action === "submit") {
      if (!can(role, "check_posts")) return fail("Only the creator submits a post for review.", 403);
      if (post.status !== "draft" && post.status !== "changes_requested") return fail("This post has already been submitted.", 409);
      const { data: review } = await db().from("reviews").select("id, findings").eq("post_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!review) return fail("Check the post before submitting it.", 409);
      const { data: decisions } = await db().from("decisions").select("action").eq("post_id", id).eq("review_id", review.id).eq("action", "disagree").limit(1);
      const disputed = (decisions ?? []).length > 0;
      const expert = needsExpert(review.findings as Finding[], new Set(), disputed);
      const assigned = expert ? "expert" : "brand_manager";
      await Promise.all([db().from("posts").update({ status: "in_review", needs_expert: expert, expert_approved: false, assigned_role: assigned, updated_at: now }).eq("id", id), addHistory(id, "submitted", role, actor, {
        sent_to: ROLE_LABEL[assigned],
        why: expert ? (disputed ? "The creator disagreed with a finding." : "It has open claim or high-severity problems.") : "No open claims or serious problems.",
        comment,
      })]);
      return json({ ok: true, assigned_role: assigned });
    }

    // approve / request_changes
    if (post.status !== "in_review") return fail("This post isn't waiting for review.", 409);
    if (role !== post.assigned_role) return fail(`This post is waiting for the ${ROLE_LABEL[post.assigned_role as keyof typeof ROLE_LABEL] ?? "reviewer"}. Switch role to act on it.`, 403);

    if (action === "request_changes") {
      if (!comment || comment.length < 3) return fail("Tell the creator what to change.");
      await Promise.all([db().from("posts").update({ status: "changes_requested", assigned_role: null, expert_approved: false, updated_at: now }).eq("id", id), addHistory(id, "requested changes", role, actor, { comment })]);
      return json({ ok: true });
    }

    if (role === "expert") {
      await Promise.all([db().from("posts").update({ expert_approved: true, assigned_role: "brand_manager", updated_at: now }).eq("id", id), addHistory(id, "expert approved", role, actor, { comment, next: "Brand manager" })]);
      return json({ ok: true, assigned_role: "brand_manager" });
    }
    if (post.needs_expert && !post.expert_approved) return fail("The expert reviewer must approve first.", 409);
    await Promise.all([db().from("posts").update({ status: "approved", assigned_role: null, updated_at: now }).eq("id", id), addHistory(id, "approved", role, actor, { comment })]);
    return json({ ok: true, status: "approved" });
  } catch (e) {
    return serverError(e, "posts/[id]/action");
  }
}, "posts/[id]/action");
