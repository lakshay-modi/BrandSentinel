import { db } from "@/lib/db";
import { fail, json } from "@/lib/api";

/** One post with its latest review, every human decision and the full history. */
export async function GET(_req: Request, ctx: RouteContext<"/api/posts/[id]">) {
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
    return json({ post: post.data, review: review.data, decisions: decisions.data ?? [], history: history.data ?? [] });
  } catch (e) {
    return fail(String(e instanceof Error ? e.message : e), 500);
  }
}
