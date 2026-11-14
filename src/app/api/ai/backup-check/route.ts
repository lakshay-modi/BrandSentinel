import { allow, clientId, fail, json } from "@/lib/api";
import { getBrandContext } from "@/lib/db";
import { runReview } from "@/lib/review/run-review";
import { BACKUP_MODEL, backupConfigured, probeBackup } from "@/lib/ai/gemini";
import { withSession } from "@/lib/session";

export const maxDuration = 60;

const SAMPLE = "Our new protein bar is the healthiest snack ever and cures tiredness! 100% natural, buy now!!!";

/**
 * Brand manager: ask the backup AI one tiny question and show how it answered (or why it didn't),
 * to check it is set up. With {"full": true} it runs a real check of a sample post on the current brand
 * through the backup alone. Nothing is saved. Never shows the key.
 */
export const POST = withSession(async (req, _ctx, me) => {
  if (me.memberRole !== "brand_manager") return fail("Only a brand manager can test the backup AI.", 403);
  if (!backupConfigured()) return json({ configured: false });
  if (!allow("backup-check", clientId(req), 5, 10 * 60_000) || !allow("backup-check", "all", 20, 60 * 60_000)) return fail("Too many tests. Wait a few minutes.", 429);
  const t0 = Date.now();
  const full = await req.json().then((b: { full?: unknown }) => b?.full === true).catch(() => false);
  if (full) {
    const ctx = await getBrandContext();
    const out = await runReview({ channel: "instagram", post_type: "product", product: "", partner: false, caption: SAMPLE, images: [] }, ctx, { origin: new URL(req.url).origin, clientId: clientId(req), backupOnly: true });
    return json({ configured: true, model: out.model, ms: Date.now() - t0, brand: ctx.brand.name, ai_status: out.ai_status, detail: out.ai_detail, score: out.score, problems: out.findings.length, ai_problems: out.findings.filter((f) => f.source === "ai").length, dropped: out.dropped, suggested_caption: out.suggested_caption });
  }
  const res = await probeBackup();
  return json({ configured: true, model: BACKUP_MODEL, ms: Date.now() - t0, ...(res.ok ? { ok: true, answer: res.text.slice(0, 200) } : { ok: false, status: res.status, detail: res.detail }) });
}, "ai/backup-check");
