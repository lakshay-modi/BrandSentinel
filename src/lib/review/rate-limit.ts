// Keeps the public demo inside the AI free tier: a per-visitor and a global limit per minute.
// (In-memory per server instance; good enough for a demo, a shared store would be used in production.)

const WINDOW_MS = 60_000;
const PER_CLIENT = Number(process.env.AI_LIMIT_PER_CLIENT ?? 6);
const GLOBAL = Number(process.env.AI_LIMIT_GLOBAL ?? 12);

const calls: { at: number; client: string }[] = [];

export function allowAiCall(client: string, now = Date.now()): boolean {
  while (calls.length && now - calls[0].at > WINDOW_MS) calls.shift();
  if (calls.length >= GLOBAL) return false;
  if (calls.filter((c) => c.client === client).length >= PER_CLIENT) return false;
  calls.push({ at: now, client });
  return true;
}
