import { connection } from "next/server";
import { db } from "@/lib/db";
import { clientId, json } from "@/lib/api";
import { allowAiCall } from "@/lib/review/rate-limit";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

async function probe(model: string, key: string, thinking: object | null) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: 'Reply with exactly {"ok":true}' }] }],
        generationConfig: { responseMimeType: "application/json", ...(thinking ? { thinkingConfig: thinking } : {}) },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const text = res.ok ? "" : (await res.text()).slice(0, 160);
    return { model, thinking, status: res.status, ms: Date.now() - t0, error: text || undefined };
  } catch (e) {
    return { model, thinking, status: 0, ms: Date.now() - t0, error: e instanceof Error ? e.name : String(e) };
  }
}

/** Health check: database reachable, and (with ?ai=1) which Gemini models answer and how fast. Never returns keys. */
export async function GET(req: Request) {
  await connection();
  const out: Record<string, unknown> = {};
  const t0 = Date.now();
  const { error } = await db().from("brands").select("id").limit(1);
  out.db = error ? `error: ${error.message}` : `ok (${Date.now() - t0} ms)`;
  out.ai_key = !!process.env.GEMINI_API_KEY;
  const url = new URL(req.url);
  if (url.searchParams.get("ai") === "1" && process.env.GEMINI_API_KEY) {
    if (!allowAiCall(clientId(req))) return json({ ...out, ai: "rate limited, try in a minute" });
    const key = process.env.GEMINI_API_KEY;
    const models = (url.searchParams.get("models") ?? `${process.env.GEMINI_MODEL ?? "gemini-3.8-flash"},gemini-flash-lite-latest,gemini-flash-latest`).split(",").slice(0, 4);
    const mode = url.searchParams.get("thinking");
    const thinking = mode === "level" ? { thinkingLevel: "low" } : mode === "budget" ? { thinkingBudget: 0 } : null;
    out.ai = await Promise.all(models.map((m) => probe(m.trim(), key, thinking)));
  }
  return json(out);
}
