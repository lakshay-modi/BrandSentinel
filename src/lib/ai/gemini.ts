// Minimal Gemini client (REST). All AI calls in the app go through this one file,
// so the provider can be swapped without touching the rest of the code.
import "server-only";
import { currentAiKey } from "../secrets";

export type AiCallResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: "busy" | "off" | "error"; detail: string };

export interface AiPart {
  text?: string;
  image?: { mimeType: string; base64: string };
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function aiModels(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim();
  // Flash first for quality, Flash-Lite as the fast fallback when Flash is overloaded.
  return [...new Set([primary, "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-flash-latest"].filter((m): m is string => !!m))];
}

export function aiConfigured(): boolean {
  return !!currentAiKey();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls Gemini and returns the raw JSON text.
 * Free-tier limits and outages are per model, so on "busy" answers (429, 5xx) or an unknown model (404)
 * it retries once and then falls back to the next Flash model, within a total time budget.
 */
export async function callGemini(
  system: string,
  parts: AiPart[],
  budgetMs = 50000,
  /** time allowed for the first model, then for each fallback (long answers like a whole Rulebook need more) */
  limits: { firstMs: number; laterMs: number } = { firstMs: 14000, laterMs: 20000 },
): Promise<AiCallResult> {
  // the workspace's own key when it has one, otherwise the shared demo key
  const key = currentAiKey();
  if (!key) return { ok: false, status: "off", detail: "No AI key is set" };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: parts.map((p) => (p.image ? { inline_data: { mime_type: p.image.mimeType, data: p.image.base64 } } : { text: p.text ?? "" })),
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  });

  const deadline = Date.now() + budgetMs;
  const tried: string[] = [];
  let sawBusy = false;

  for (const model of aiModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 3000) return { ok: false, status: "busy", detail: `Out of time. Tried: ${tried.join(", ")}` };
      const controller = new AbortController();
      // the first model gets a short limit so an overloaded model doesn't eat the whole budget
      const limit = tried.length === 0 ? limits.firstMs : limits.laterMs;
      const timer = setTimeout(() => controller.abort(), Math.min(limit, left));
      try {
        const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body,
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json();
          const text: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
          if (text) return { ok: true, text, model };
          tried.push(`${model}: empty (${json?.candidates?.[0]?.finishReason ?? "unknown"})`);
          break;
        }
        tried.push(`${model}: ${res.status}`);
        if (res.status === 404) break; // this model name isn't available: next model
        if (res.status === 429 || res.status >= 500) {
          sawBusy = true;
          if (attempt === 0 && res.status >= 500 && res.status !== 503) {
            await sleep(800);
            continue; // one quick retry on a temporary outage
          }
          break; // next model has its own free-tier limit
        }
        return { ok: false, status: "error", detail: `${model}: ${res.status} ${(await res.text()).slice(0, 200)}` };
      } catch (e) {
        const aborted = e instanceof Error && e.name === "AbortError";
        tried.push(`${model}: ${aborted ? "timeout" : "network error"}`);
        sawBusy = true;
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { ok: false, status: sawBusy ? "busy" : "error", detail: `No model answered. Tried: ${tried.join(", ")}` };
}

/** Pulls the first JSON object out of a model reply (handles stray ```json fences). */
export function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI reply was not JSON");
  }
}
