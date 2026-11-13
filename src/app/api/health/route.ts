import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { adminDb, dbAccessMode, dbKeyDiagnostics } from "@/lib/db";
import { json } from "@/lib/api";
import { aiModels } from "@/lib/ai/gemini";
import { guestSessionCheck } from "@/lib/session";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

async function probe(model: string, key: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: 'Reply with exactly {"ok":true}' }] }], generationConfig: { responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(20000),
    });
    return { model, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { model, status: 0, ms: Date.now() - t0, error: e instanceof Error ? e.name : "error" };
  }
}

function tokenOk(req: Request): boolean {
  const want = process.env.HEALTH_TOKEN;
  const got = req.headers.get("x-health-token");
  if (!want || !got || want.length !== got.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

/**
 * Health check for uptime monitors: is the database reachable and is AI set up. Never returns keys or errors.
 * Probing the AI models (which uses the AI quota) needs the HEALTH_TOKEN secret in an x-health-token header.
 */
export async function GET(req: Request) {
  await connection();
  const t0 = Date.now();
  const { error } = await adminDb().from("brands").select("id").limit(1);
  const out: Record<string, unknown> = { db: error ? "error" : "ok", db_ms: Date.now() - t0, db_access: dbAccessMode(), ai_configured: !!process.env.GEMINI_API_KEY };
  if (dbAccessMode() !== "secret key") out.db_key = dbKeyDiagnostics();
  // login: can the server open the public visitor's session (Supabase Auth + the demo workspace)?
  out.auth = await guestSessionCheck();
  if (new URL(req.url).searchParams.get("ai") === "1" && process.env.GEMINI_API_KEY) {
    if (!tokenOk(req)) return json({ ...out, ai: "model probe needs the health token" }, 401);
    out.ai = await Promise.all(aiModels().map((m) => probe(m, process.env.GEMINI_API_KEY!)));
  }
  return json(out, error ? 503 : 200);
}
