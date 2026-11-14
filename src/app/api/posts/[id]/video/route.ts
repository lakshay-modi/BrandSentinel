import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { withSession, type Session } from "@/lib/session";
import { MAX_VIDEO_BYTES, signVideoRead, signVideoUpload, VIDEO_TYPES, videoStored } from "@/lib/video-store";
import type { PostVideo } from "@/lib/types";

const ID = /^[0-9a-f-]{36}$/i;

/** The post, if this person can see it (the database's row rules decide) and it is a video post. */
async function videoPost(id: string) {
  const { data } = await db().from("posts").select("id, video, brand_id").eq("id", id).maybeSingle();
  return data && data.video ? { id: data.id as string, video: data.video as PostVideo } : null;
}

/** A play link for the post's video: the stored file (signed, 1 hour) or the public sample file. */
export const GET = withSession<RouteContext<"/api/posts/[id]/video">>(async (_req, ctx, me) => {
  const { id } = await ctx.params;
  if (!ID.test(id)) return fail("Invalid post", 400);
  const post = await videoPost(id);
  if (!post) return fail("This post has no video.", 404);
  if (post.video.src) return json({ url: post.video.src });
  if (!post.video.stored) return json({ url: null });
  const url = await signVideoRead(me.workspace.id, id);
  return json({ url });
}, "posts/[id]/video");

const uploadSchema = z.object({ size: z.number().int().positive(), type: z.string().max(60) });

/** Step 1: a one-time upload link, after checking the file's size and type. */
export const POST = withSession<RouteContext<"/api/posts/[id]/video">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  if (!ID.test(id)) return fail("Invalid post", 400);
  const body = await readJson(req, uploadSchema);
  if (!body.ok) return body.res;
  if (!canUpload(me)) return fail("Only the creator adds a post's video.", 403);
  if (body.data.size > MAX_VIDEO_BYTES) return fail(`The video is ${Math.round(body.data.size / 1048576)} MB. Videos up to 40 MB are stored for reviewers; reviewers still see the frames and what is said.`, 413);
  if (!VIDEO_TYPES.includes(body.data.type)) return fail("Only MP4, WebM and MOV videos can be stored.", 415);
  const post = await videoPost(id);
  if (!post) return fail("That post doesn't exist, or it has no video.", 404);
  const signed = await signVideoUpload(me.workspace.id, id, me.workspace.isDemo);
  if ("error" in signed) return fail(signed.error, 409);
  return json({ upload_url: signed.url });
}, "posts/[id]/video");

/** Step 2: the upload finished. The server checks the file is really there, then marks the post's video as stored. */
export const PATCH = withSession<RouteContext<"/api/posts/[id]/video">>(async (req, ctx, me) => {
  const { id } = await ctx.params;
  if (!ID.test(id)) return fail("Invalid post", 400);
  const body = await readJson(req, z.object({}).passthrough());
  if (!body.ok) return body.res;
  if (!canUpload(me)) return fail("Only the creator adds a post's video.", 403);
  const post = await videoPost(id);
  if (!post) return fail("That post doesn't exist, or it has no video.", 404);
  const file = await videoStored(me.workspace.id, id);
  if (!file) return fail("The video isn't in storage. Try the upload again.", 409);
  const { error } = await db().from("posts").update({ video: { ...post.video, stored: true } }).eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true, size: file.size });
}, "posts/[id]/video");

function canUpload(me: Session): boolean {
  return me.role() === "creator" || me.canSwitchRole;
}
