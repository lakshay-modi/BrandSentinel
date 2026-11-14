import { allow, clientId, fail, json } from "@/lib/api";
import { BACKUP_MODEL, backupConfigured, probeBackup } from "@/lib/ai/gemini";
import { withSession } from "@/lib/session";

export const maxDuration = 40;

/**
 * Brand manager: ask the backup AI one tiny question and show how it answered (or why it didn't),
 * to check it is set up. Never shows the key.
 */
export const POST = withSession(async (req, _ctx, me) => {
  if (me.memberRole !== "brand_manager") return fail("Only a brand manager can test the backup AI.", 403);
  if (!backupConfigured()) return json({ configured: false });
  if (!allow("backup-check", clientId(req), 5, 10 * 60_000) || !allow("backup-check", "all", 20, 60 * 60_000)) return fail("Too many tests. Wait a few minutes.", 429);
  const t0 = Date.now();
  const res = await probeBackup();
  return json({ configured: true, model: BACKUP_MODEL, ms: Date.now() - t0, ...(res.ok ? { ok: true, answer: res.text.slice(0, 200) } : { ok: false, status: res.status, detail: res.detail }) });
}, "ai/backup-check");
