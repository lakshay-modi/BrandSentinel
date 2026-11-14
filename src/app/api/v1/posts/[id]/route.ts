import { adminDb } from "@/lib/db";
import { apiJson, CORS, tokenScope } from "@/lib/tokens";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Is this post approved? A scheduling tool (or a Zapier / Make step) can ask this before publishing,
 * or wait for the "post.approved" webhook instead. Protected by a workspace token.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/posts/[id]">) {
  const scope = await tokenScope(req).catch(() => null);
  if (!scope) return apiJson({ error: "Missing or wrong token. Send it as “Authorization: Bearer <token>”." }, 401);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiJson({ error: "Invalid post id" }, 400);
  const { data: post } = await adminDb().from("posts").select("id, title, status, channel, updated_at, brands!inner(name, workspace_id)").eq("id", id).maybeSingle();
  const brand = post?.brands as unknown as { name: string; workspace_id: string } | undefined;
  // a post in another workspace looks exactly like a post that doesn't exist
  if (!post || brand?.workspace_id !== scope.workspaceId) return apiJson({ error: "Post not found" }, 404);
  const { data: approved } = post.status === "approved" ? await adminDb().from("history").select("actor, created_at").eq("post_id", id).eq("action", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  return apiJson({
    id: post.id,
    title: post.title,
    brand: brand.name,
    channel: post.channel,
    status: post.status,
    approved: post.status === "approved",
    approved_by: approved?.actor ?? null,
    approved_at: approved?.created_at ?? null,
    url: `${new URL(req.url).origin}/posts/${post.id}`,
  });
}
