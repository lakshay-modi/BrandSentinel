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

/** Gemini 3 models take a thinking level (2.5 models don't, and "latest" names could be either). */
export function usesThinkingLevel(model: string): boolean {
  return /^gemini-3(\.\d+)?-/.test(model);
}

export function aiConfigured(): boolean {
  return !!currentAiKey() || backupAvailable();
}

const BACKUP_ENDPOINT = "https://api.asi1.ai/v1/chat/completions";
export const BACKUP_MODEL = "asi1";
/** ASI:One models in order: the low-latency one first (a check must finish within the request's time), then the
 * general one if the first is refused. ASI1_MODEL overrides the first. Answers are reported as "asi1" either way. */
function backupModels(): string[] {
  return [...new Set([process.env.ASI1_MODEL?.trim() || "asi1-fast", BACKUP_MODEL])];
}

function backupKey(): string | null {
  // ASIAPI is accepted as another name for the same key
  return process.env.ASI1_API_KEY?.trim() || process.env.ASIAPI?.trim() || null;
}

/**
 * The backup AI stands in only for BrandSentinel's shared key. A company that brought its own Gemini key keeps
 * its posts with the one provider it chose.
 */
export function backupAvailable(): boolean {
  return !!backupKey() && usingSharedAiKey();
}

/** True when this request uses BrandSentinel's shared key (not a company's own Gemini key). */
export function usingSharedAiKey(): boolean {
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

export function backupConfigured(): boolean {
  return !!backupKey();
}

/** The backup AI alone (used to test it with a real check, optionally with one named ASI:One model). */
export function callBackupOnly(system: string, parts: AiPart[], budgetMs: number, model?: string): Promise<AiCallResult> {
  return callBackup(system, parts, budgetMs, model);
}

/** One tiny question to the backup AI, to check it is set up. */
export function probeBackup(): Promise<AiCallResult> {
  return callBackup('You check that a service works. Reply with JSON only.', [{ text: 'Reply with exactly {"ok":true}' }], 30000);
}

async function callBackup(system: string, parts: AiPart[], budgetMs: number, onlyModel?: string): Promise<AiCallResult> {
  const key = backupKey();
  if (!key) return { ok: false, status: "off", detail: "No backup AI key is set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  let res: Response | null = null;
  let used = BACKUP_MODEL;
  const refused: string[] = [];
  try {
    for (const model of onlyModel ? [onlyModel] : backupModels()) {
      if (res) refused.push(`${used}: ${res.status}`);
      used = model;
      res = await fetch(BACKUP_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${system}\n\nReply with one JSON object only: no other text and no code fences.` },
            { role: "user", content: backupPrompt(parts) },
          ],
          temperature: 0.1,
          stream: false,
        }),
        signal: controller.signal,
      });
      // a model this key can't use (unknown name, not on the plan): try the next one
      if (res.ok || ![400, 404, 422].includes(res.status)) break;
    }
    if (!res || !res.ok) {
      const status = res?.status ?? 0;
      const busy = status === 429 || status >= 500;
      return { ok: false, status: busy ? "busy" : "error", detail: `${[...refused, ""].join(", ")}${used}: ${status}${busy || !res ? "" : ` ${(await res.text()).slice(0, 200)}`}` };
    }
    const json = await res.json();
    const text = stripThinking(String(json?.choices?.[0]?.message?.content ?? ""));
    if (!text) return { ok: false, status: "error", detail: `${BACKUP_MODEL}: empty answer` };
    return { ok: true, text, model: BACKUP_MODEL };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: "busy", detail: `${[...refused, ""].join(", ")}${used}: ${aborted ? "timeout" : "network error"}` };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls the AI and returns the raw JSON text.
 * Free-tier limits and outages are per model, so on "busy" answers (429, 5xx) or an unknown model (404)
 * it retries once and then falls back to the next Flash model, within a total time budget.
 * Text-only work also has the backup AI: it starts at once when Gemini fails, or after hedgeMs when Gemini
 * is slow, and the first good answer is used.
 */
export async function callGemini(
  system: string,
  parts: AiPart[],
  budgetMs = 50000,
  /** time allowed for the first model, then for each fallback (long answers like a whole Rulebook need more) */
  limits: { firstMs: number; laterMs: number } = { firstMs: 14000, laterMs: 20000 },
  /** if Gemini hasn't answered by then, the backup AI starts as well and the first good answer wins */
  hedgeMs = 10000,
): Promise<AiCallResult> {
  const start = Date.now();
  const left = () => budgetMs - (Date.now() - start);
  // the backup reads text only, so it can't stand in for work that is all about sound (speech to text)
  const backup = backupAvailable() && !parts.some((p) => p.image && !p.image.mimeType.startsWith("image/"));
  if (!backup) return callGeminiOnly(system, parts, budgetMs, limits);

  // AI_BACKUP_FIRST=1 sends work to the backup first (used to test it); Gemini still answers if the backup can't
  if (process.env.AI_BACKUP_FIRST === "1") {
    const first = await callBackup(system, parts, Math.max(budgetMs - 15000, 5000));
    if (first.ok) return first;
    console.warn(`[ai] backup first didn't answer: ${first.detail}`);
    return callGeminiOnly(system, parts, left(), limits);
  }

  const gemini = callGeminiOnly(system, parts, budgetMs, limits);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const early = await Promise.race([gemini, new Promise<null>((r) => (timer = setTimeout(() => r(null), hedgeMs)))]);
  clearTimeout(timer);
  if (early?.ok) return early;
  // Gemini failed quickly (often: free quota used up) or is slow: the backup starts now with the time left
  if (left() < 4000) return early ?? gemini;
  const second = callBackup(system, parts, left());
  const result = early ? await second : await firstOk(gemini, second);
  if (result.ok) return result;
  const main = early ?? (await gemini);
  const backupResult = await second;
  if (main.ok) return main;
  if (backupResult.ok) return backupResult;
  console.warn(`[ai] neither AI answered: ${main.detail}. Backup: ${backupResult.detail}`);
  const status = main.status === "off" ? backupResult.status : main.status === "busy" || backupResult.status === "busy" ? "busy" : "error";
  return { ok: false, status, detail: `${main.detail}. Backup: ${backupResult.detail}` };
}

/** The first answer that worked, or (when neither did) the first one's failure. */
function firstOk(a: Promise<AiCallResult>, b: Promise<AiCallResult>): Promise<AiCallResult> {
  return new Promise((resolve) => {
    let failed: AiCallResult | null = null;
    for (const p of [a, b]) {
      void p.then((r) => {
        if (r.ok) resolve(r);
        else if (failed) resolve(failed);
        else failed = r;
      });
    }
  });
}

async function callGeminiOnly(system: string, parts: AiPart[], budgetMs: number, limits: { firstMs: number; laterMs: number }): Promise<AiCallResult> {
  // the workspace's own key when it has one, otherwise the shared demo key
  const key = currentAiKey();
  if (!key) return { ok: false, status: "off", detail: "No AI key is set" };

  // Gemini 3 models think before answering ("medium" by default on Flash), which can take longer than our time
  // limits. Checking against rules needs little thinking, so they are asked to think "low" (faster answers).
  const body = (thinking: boolean) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: "user",
          parts: parts.map((p) => (p.image ? { inline_data: { mime_type: p.image.mimeType, data: p.image.base64 } } : { text: p.text ?? "" })),
        },
      ],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
    });

  const deadline = Date.now() + budgetMs;
  const tried: string[] = [];
  let sawBusy = false;

  for (const model of aiModels()) {
    let thinking = usesThinkingLevel(model);
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
          body: body(thinking),
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
        if (res.status === 400 && thinking) {
          thinking = false; // this model doesn't take the thinking setting: ask again without it
          continue;
        }
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
