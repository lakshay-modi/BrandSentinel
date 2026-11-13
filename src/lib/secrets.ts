// A workspace's own AI key. It is encrypted before it is stored, shown again only as its last 4 characters,
// and decrypted only on the server at the moment an AI call is made.
import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { adminDb, requestScope } from "./db";

function encryptionKey(): Buffer | null {
  const secret = process.env.BRANDSENTINEL_ENC_KEY?.trim() || process.env.BRANDSENTINEL_DB_KEY?.trim();
  if (!secret) return null;
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), "brandsentinel-workspace-secrets-v1", 32));
}

export function canStoreSecrets(): boolean {
  return encryptionKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("No server secret to encrypt with");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(stored: string): string | null {
  const key = encryptionKey();
  if (!key) return null;
  try {
    const raw = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null; // the server secret changed: the key has to be entered again
  }
}

/** A one-way fingerprint, for tokens that are looked up but never shown again. */
export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface AiKeyInfo {
  /** "own": the workspace's own key; "shared": BrandSentinel's free demo key; "none": AI is off */
  source: "own" | "shared" | "none";
  hint: string | null;
  /** an own key is stored but can't be read any more and must be entered again */
  unreadable?: boolean;
}

export async function aiKeyInfo(workspaceId: string): Promise<AiKeyInfo & { key: string | null }> {
  const shared = process.env.GEMINI_API_KEY?.trim() || null;
  const { data } = await adminDb().from("workspace_secrets").select("ai_key_enc, ai_key_hint").eq("workspace_id", workspaceId).maybeSingle();
  if (data?.ai_key_enc) {
    const key = decryptSecret(data.ai_key_enc as string);
    if (key) return { source: "own", hint: (data.ai_key_hint as string) ?? null, key };
    return { source: shared ? "shared" : "none", hint: null, key: shared, unreadable: true };
  }
  return { source: shared ? "shared" : "none", hint: null, key: shared };
}

/** Before an AI call: use this workspace's own key for the rest of the request, if it has one. */
export async function useWorkspaceAiKey(workspaceId: string): Promise<AiKeyInfo> {
  const info = await aiKeyInfo(workspaceId).catch(() => ({ source: process.env.GEMINI_API_KEY ? ("shared" as const) : ("none" as const), hint: null, key: process.env.GEMINI_API_KEY ?? null }));
  const scope = requestScope.getStore();
  if (scope) scope.aiKey = info.key;
  return { source: info.source, hint: info.hint };
}

/** The AI key for the current request: the workspace's own if it was loaded, otherwise the shared one. */
export function currentAiKey(): string | null {
  const scope = requestScope.getStore();
  if (scope && scope.aiKey !== undefined) return scope.aiKey;
  return process.env.GEMINI_API_KEY?.trim() || null;
}
