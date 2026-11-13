import { withSession } from "@/lib/session";
import { connection } from "next/server";
import { db, getBrandContext } from "@/lib/db";
import { json, serverError } from "@/lib/api";
import { computeInsights } from "@/lib/insights";
import { todayIST } from "@/lib/checks/text-utils";

export const GET = withSession(async () => {
  await connection();
  try {
    const { brand, rules, facts } = await getBrandContext();
    const { data: posts, error } = await db().from("posts").select("id, status, created_by").eq("brand_id", brand.id);
    if (error) throw new Error(error.message);
    const ids = (posts ?? []).map((p) => p.id);
    const [reviews, decisions] = ids.length
      ? await Promise.all([
          db().from("reviews").select("post_id, score, findings, ask_human, created_at").in("post_id", ids),
          db().from("decisions").select("rule_id, action, reason, actor, created_at").in("post_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    return json(computeInsights({ posts: posts ?? [], reviews: reviews.data ?? [], decisions: decisions.data ?? [], rules, facts, today: todayIST() }));
  } catch (e) {
    return serverError(e, "insights");
  }
}, "insights");
