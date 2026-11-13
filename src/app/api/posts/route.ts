import { withSession } from "@/lib/session";
import { connection } from "next/server";
import { db, getBrandRow } from "@/lib/db";
import { json, serverError } from "@/lib/api";

/** All posts for the selected brand, newest first, with their latest brand score. */
export const GET = withSession(async () => {
  await connection();
  try {
    const brand = await getBrandRow();
    const { data: posts, error } = await db()
      .from("posts")
      .select("id, title, channel, post_type, product, status, assigned_role, needs_expert, expert_approved, created_by, sample_id, demo, updated_at")
      .eq("brand_id", brand.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = (posts ?? []).map((p) => p.id);
    const { data: reviews } = ids.length
      ? await db().from("reviews").select("post_id, score, band, findings, created_at").in("post_id", ids).order("created_at", { ascending: false })
      : { data: [] };
    const latest = new Map<string, { score: number; band: string; problems: number }>();
    for (const r of reviews ?? []) if (!latest.has(r.post_id)) latest.set(r.post_id, { score: r.score, band: r.band, problems: (r.findings ?? []).length });
    return json({ posts: (posts ?? []).map((p) => ({ ...p, latest: latest.get(p.id) ?? null })) });
  } catch (e) {
    return serverError(e, "posts");
  }
}, "posts");
