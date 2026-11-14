// Stored videos. A checked video is kept privately so reviewers on other devices can play it and jump to each
// problem. The browser uploads straight to storage with a one-time link (videos are too big to pass through
// the app's server), and anyone in the workspace plays it through a signed link that lasts an hour.
import "server-only";
import { adminDb } from "./db";

export const VIDEO_BUCKET = "post-videos";
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
/** the shared demo keeps its newest videos and drops the oldest; a company's workspace is never trimmed silently */
const DEMO_KEEP = 20;
const WORKSPACE_LIMIT = 40;

export const videoPath = (workspaceId: string, postId: string) => `${workspaceId}/${postId}`;

/** A one-time link the browser uploads the file to. */
export async function signVideoUpload(workspaceId: string, postId: string, isDemo: boolean): Promise<{ url: string } | { error: string }> {
  const bucket = adminDb().storage.from(VIDEO_BUCKET);
  const { data: files } = await bucket.list(workspaceId, { limit: 200, sortBy: { column: "created_at", order: "asc" } });
  const others = (files ?? []).filter((f) => f.name !== postId);
  if (isDemo && others.length >= DEMO_KEEP) {
    await bucket.remove(others.slice(0, others.length - DEMO_KEEP + 1).map((f) => videoPath(workspaceId, f.name)));
  } else if (!isDemo && others.length >= WORKSPACE_LIMIT) {
    return { error: `This workspace already stores ${WORKSPACE_LIMIT} videos (the free plan's limit). Delete old video drafts to store new ones.` };
  }
  const { data, error } = await bucket.createSignedUploadUrl(videoPath(workspaceId, postId), { upsert: true });
  if (error || !data) return { error: `Storage refused the upload: ${error?.message ?? "no link"}` };
  return { url: data.signedUrl };
}

/** True once the file is really in storage. */
export async function videoStored(workspaceId: string, postId: string): Promise<{ size: number } | null> {
  const { data } = await adminDb().storage.from(VIDEO_BUCKET).list(workspaceId, { search: postId, limit: 5 });
  const f = (data ?? []).find((x) => x.name === postId);
  if (!f) return null;
  return { size: Number((f.metadata as { size?: number } | null)?.size ?? 0) };
}

/** A play link that works for an hour. */
export async function signVideoRead(workspaceId: string, postId: string): Promise<string | null> {
  const { data } = await adminDb().storage.from(VIDEO_BUCKET).createSignedUrl(videoPath(workspaceId, postId), 3600);
  return data?.signedUrl ?? null;
}

export async function removeVideo(workspaceId: string, postId: string): Promise<void> {
  await adminDb().storage.from(VIDEO_BUCKET).remove([videoPath(workspaceId, postId)]);
}

/** After Reset demo: drop stored videos whose post no longer exists. */
export async function removeOrphanVideos(workspaceId: string, livePostIds: Set<string>): Promise<number> {
  const bucket = adminDb().storage.from(VIDEO_BUCKET);
  const { data } = await bucket.list(workspaceId, { limit: 500 });
  const gone = (data ?? []).filter((f) => !livePostIds.has(f.name)).map((f) => videoPath(workspaceId, f.name));
  if (gone.length) await bucket.remove(gone);
  return gone.length;
}
