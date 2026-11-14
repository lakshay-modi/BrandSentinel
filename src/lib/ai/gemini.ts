// Minimal AI client (REST). All AI calls in the app go through this one file, so the provider can be swapped
// without touching the rest of the code. Gemini answers first; when it is busy or out of free quota, text-only
// work goes to the backup AI (ASI:One) instead of dropping to the fast checks alone.
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
  return !!currentAiKey() || backupAvailable();
}

const BACKUP_ENDPOINT = "https://api.asi1.ai/v1/chat/completions";
export const BACKUP_MODEL = "asi1";

function backupKey(): string | null {
  return process.env.ASI1_API_KEY?.trim() || null;
}

/**
 * The backup AI stands in only for BrandSentinel's shared key. A company that brought its own Gemini key keeps
 * its posts with the one provider it chose.
 */
export function backupAvailable(): boolean {
  if (!backupKey()) return false;
  const key = currentAiKey();
  return !key || key === (process.env.GEMINI_API_KEY?.trim() || null);
}

/** The text sent to the backup AI: it reads text only, so images are left out and it is told so. */
export function backupPrompt(parts: AiPart[]): string {
  const hadImages = parts.some((p) => p.image);
  const text = parts
    .filter((p) => !p.image && typeof p.text === "string" && !/^Image \d+:$/.test(p.text.trim()))
    .map((p) => p.text)
    .join("\n\n");
  return hadImages ? `${text}\n\n(The images themselves can't be shown in this check. Use the text read from them, and don't suggest alt text for images you can't see.)` : text;
}

/** Some models think out loud before answering: keep only the answer. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function callBackup(system: string, parts: AiPart[], budgetMs: number): Promise<AiCallResult> {
  const key = backupKey();
  if (!key) return { ok: false, status: "off", detail: "No backup AI key is set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const res = await fetch(BACKUP_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: BACKUP_MODEL,
        messages: [
          { role: "system", content: `${system}\n\nReply with one JSON object only: no other text and no code fences.` },
          { role: "user", content: backupPrompt(parts) },
        ],
        temperature: 0.1,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const busy = res.status === 429 || res.status >= 500;
      return { ok: false, status: busy ? "busy" : "error", detail: `${BACKUP_MODEL}: ${res.status}${busy ? "" : ` ${(await res.text()).slice(0, 200)}`}` };
    }
    const json = await res.json();
    const text = stripThinking(String(json?.choices?.[0]?.message?.content ?? ""));
    if (!text) return { ok: false, status: "error", detail: `${BACKUP_MODEL}: empty answer` };
    return { ok: true, text, model: BACKUP_MODEL };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: "busy", detail: `${BACKUP_MODEL}: ${aborted ? "timeout" : "network error"}` };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls the AI and returns the raw JSON text.
 * Free-tier limits and outages are per model, so on "busy" answers (429, 5xx) or an unknown model (404)
 * it retries once and then falls back to the next Flash model, within a total time budget.
 * If no Gemini model answers, text-only work goes to the backup AI in the time kept back for it.
 */
export async function callGemini(
  system: string,
  parts: AiPart[],
  budgetMs = 50000,
  /** time allowed for the first model, then for each fallback (long answers like a whole Rulebook need more) */
  limits: { firstMs: number; laterMs: number } = { firstMs: 14000, laterMs: 20000 },
  /** time kept back for the backup AI when Gemini doesn't answer */
  backupMs = 18000,
): Promise<AiCallResult> {
  const start = Date.now();
  // the backup reads text only, so it can't stand in for work that is all about sound (speech to text)
  const backup = backupAvailable() && !parts.some((p) => p.image && !p.image.mimeType.startsWith("image/"));
  // AI_BACKUP_FIRST=1 sends work to the backup first (used to test it); Gemini still answers if the backup can't
  if (backup && process.env.AI_BACKUP_FIRST === "1") {
    const first = await callBackup(system, parts, Math.min(backupMs + 10000, budgetMs - 15000));
    if (first.ok) return first;
  }
  const geminiBudget = budgetMs - (Date.now() - start) - (backup ? backupMs : 0);
  const main = await callGeminiOnly(system, parts, geminiBudget, limits);
  if (main.ok || !backup) return main;
  const left = budgetMs - (Date.now() - start);
  if (left < 4000) return main;
  const second = await callBackup(system, parts, left);
  if (second.ok) return second;
  const status = main.status === "off" ? second.status : main.status === "busy" || second.status === "busy" ? "busy" : "error";
  return { ok: false, status, detail: `${main.detail}. Backup: ${second.detail}` };
}

async function callGeminiOnly(system: string, parts: AiPart[], budgetMs: number, limits: { firstMs: number; laterMs: number }): Promise<AiCallResult> {
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
