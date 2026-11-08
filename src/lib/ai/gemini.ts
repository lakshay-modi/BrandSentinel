// Minimal Gemini client (REST). All AI calls in the app go through this one file,
// so the provider can be swapped without touching the rest of the code.
import "server-only";

export type AiCallResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: "busy" | "off" | "error"; detail: string };

export interface AiPart {
  text?: string;
  image?: { mimeType: string; base64: string };
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function models(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim();
  return [...new Set([primary, "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"].filter((m): m is string => !!m))];
}

export function aiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Calls Gemini and returns the raw JSON text. Tries fallback model names if one isn't available. */
export async function callGemini(system: string, parts: AiPart[], timeoutMs = 25000): Promise<AiCallResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, status: "off", detail: "GEMINI_API_KEY is not set" };

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: parts.map((p) => (p.image ? { inline_data: { mime_type: p.image.mimeType, data: p.image.base64 } } : { text: p.text ?? "" })),
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  };

  let lastDetail = "";
  for (const model of models()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 429) return { ok: false, status: "busy", detail: "Gemini rate limit reached" };
      if (res.status === 404 || res.status === 400) {
        lastDetail = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
        if (res.status === 404) continue; // model name not available: try the next one
        return { ok: false, status: "error", detail: lastDetail };
      }
      if (!res.ok) return { ok: false, status: res.status >= 500 ? "busy" : "error", detail: `${model}: HTTP ${res.status}` };
      const json = await res.json();
      const text: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      if (!text) return { ok: false, status: "error", detail: `${model}: empty response (${json?.candidates?.[0]?.finishReason ?? "unknown"})` };
      return { ok: true, text, model };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return { ok: false, status: aborted ? "busy" : "error", detail: aborted ? "Gemini timed out" : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: "error", detail: lastDetail || "No Gemini model available" };
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
