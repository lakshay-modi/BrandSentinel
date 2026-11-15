// Keeps the shared AI key inside its free tier: a per-visitor limit and a global limit per minute.
// (In-memory per server instance; good enough for a demo, a shared store would be used in production.)
// When the global Gemini budget is used up, checks can still go to the backup AI; one visitor checking
// very fast gets the fast checks only for a minute.

const WINDOW_MS = 60_000;
const PER_CLIENT = Number(process.env.AI_LIMIT_PER_CLIENT ?? 8);
const GLOBAL = Number(process.env.AI_LIMIT_GLOBAL ?? 12);

const calls: { at: number; client: string; gemini: boolean }[] = [];

/** "ok": use Gemini. "global": Gemini's shared budget is used up this minute. "client": this visitor ran too many checks. */
export type AiAllowance = "ok" | "global" | "client";

export function aiAllowance(client: string, opts: { sharedKey?: boolean } = {}, now = Date.now()): AiAllowance {
  while (calls.length && now - calls[0].at > WINDOW_MS) calls.shift();
  if (calls.filter((c) => c.client === client).length >= PER_CLIENT) return "client";
  // a company's own Gemini key has its own quota, so only the shared key has a global budget
  const sharedKey = opts.sharedKey ?? true;
  if (sharedKey && calls.filter((c) => c.gemini).length >= GLOBAL) {
    calls.push({ at: now, client, gemini: false });
    return "global";
  }
  calls.push({ at: now, client, gemini: sharedKey });
  return "ok";
}

/** For AI work with no backup (speech to text, rulebook import): only "ok" may go ahead. */
export function allowAiCall(client: string, now = Date.now()): boolean {
  return aiAllowance(client, {}, now) === "ok";
}

/** Test helper: forget every recorded call. */
export function resetAiLimits() {
  calls.length = 0;
}
