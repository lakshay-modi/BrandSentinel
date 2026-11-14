// Outgoing signals. When a post is approved, the workspace's webhook is told, so a scheduling tool can wait
// for it before publishing. When a post needs someone, the workspace's Slack channel is told.
// Both are free: a webhook is one HTTPS request, and Slack's incoming webhooks cost nothing.
import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { adminDb, DEMO_WORKSPACE } from "./db";
import { decryptSecret } from "./secrets";

export type HookEvent = "post.submitted" | "post.expert_approved" | "post.changes_requested" | "post.approved" | "test";

export interface HookPost {
  id: string;
  title: string;
  channel: string;
  status: string;
  /** who has to act now, if anyone */
  waiting_for: "expert" | "brand_manager" | "creator" | null;
  created_by: string;
  brand: string;
  score: number | null;
}

/** Private, loopback and link-local addresses: a hook must never point inside the server's own network. */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateAddress(v.slice(7)); // an IPv4 address written as IPv6
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}

/** A webhook address a workspace may use: public HTTPS only. Returns a plain reason when it isn't. */
export async function checkHookUrl(raw: string, resolve = true): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "That isn't a web address. It should start with https://" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "The address must start with https://" };
  if (url.username || url.password) return { ok: false, reason: "The address can't contain a user name or password." };
  if (url.port && url.port !== "443") return { ok: false, reason: "Only the standard HTTPS port is allowed." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, reason: "That address points inside a private network." };
  if (isIP(host)) return privateAddress(host) ? { ok: false, reason: "That address points inside a private network." } : { ok: true, url };
  if (!host.includes(".")) return { ok: false, reason: "That isn't a public web address." };
  if (resolve) {
    try {
      const found = await lookup(host, { all: true });
      if (!found.length || found.some((a) => privateAddress(a.address))) return { ok: false, reason: "That address points inside a private network." };
    } catch {
      return { ok: false, reason: `“${host}” couldn't be found. Check the address.` };
    }
  }
  return { ok: true, url };
}

/** Slack's incoming webhooks all live at this address. */
export function isSlackHook(raw: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,200}$/.test(raw);
}

export function newHookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** The signature a receiver checks to know the request really came from BrandSentinel. */
export function sign(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

interface Settings {
  webhookUrl: string | null;
  webhookSecret: string | null;
  slackUrl: string | null;
}

export async function hookSettings(workspaceId: string): Promise<Settings> {
  const { data } = await adminDb().from("workspace_secrets").select("webhook_url_enc, webhook_secret_enc, slack_url_enc").eq("workspace_id", workspaceId).maybeSingle();
  const read = (v: unknown) => (typeof v === "string" && v ? decryptSecret(v) : null);
  return { webhookUrl: read(data?.webhook_url_enc), webhookSecret: read(data?.webhook_secret_enc), slackUrl: read(data?.slack_url_enc) };
}

async function log(row: { workspace_id: string; kind: "webhook" | "slack"; event: string; post?: HookPost | null; target: string; ok: boolean; status?: number | null; ms?: number; detail?: string }) {
  await adminDb()
    .from("hook_deliveries")
    .insert({ workspace_id: row.workspace_id, kind: row.kind, event: row.event, post_id: row.post?.id ?? null, post_title: (row.post?.title ?? "").slice(0, 120), target: row.target, ok: row.ok, status: row.status ?? null, ms: row.ms ?? null, detail: (row.detail ?? "").slice(0, 300) })
    .then(({ error }) => error && console.error("[hooks] could not log a delivery", error.message));
}

async function post(url: string, body: string, headers: Record<string, string>): Promise<{ ok: boolean; status: number | null; ms: number; detail: string }> {
  const started = Date.now();
  try {
    // redirects are not followed: a redirect could lead somewhere the address check never saw
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "BrandSentinel-Hooks/1", ...headers }, body, redirect: "manual", signal: AbortSignal.timeout(5000) });
    const ok = res.status >= 200 && res.status < 300;
    return { ok, status: res.status, ms: Date.now() - started, detail: ok ? "Delivered" : res.status >= 300 && res.status < 400 ? "The address redirects elsewhere; use the final address." : `The receiver answered ${res.status}.` };
  } catch (e) {
    const timeout = e instanceof Error && /timeout|aborted/i.test(`${e.name} ${e.message}`);
    return { ok: false, status: null, ms: Date.now() - started, detail: timeout ? "No answer within 5 seconds." : "Couldn't connect to the address." };
  }
}

const EVENT_TEXT: Record<HookEvent, (p: HookPost) => string> = {
  "post.submitted": (p) => `:eyes: A post needs ${p.waiting_for === "expert" ? "an *expert review*" : "the *brand manager's approval*"}`,
  "post.expert_approved": () => ":white_check_mark: The expert approved a post. It now needs the *brand manager's approval*",
  "post.changes_requested": (p) => `:pencil2: Changes were requested. *${p.created_by || "The creator"}* needs to update a post`,
  "post.approved": () => ":tada: A post was *approved* and is ready to publish",
  test: () => ":wave: This is a test message from BrandSentinel. Slack is connected",
};

export function slackText(event: HookEvent, p: HookPost | null, link: string | null): string {
  if (!p) return EVENT_TEXT.test({} as HookPost) + ".";
  const title = p.title.replace(/[<>&]/g, " ").slice(0, 90);
  return `${EVENT_TEXT[event](p)}: ${link ? `<${link}|${title}>` : `“${title}”`} (${p.brand}, ${p.channel}${p.score !== null ? `, score ${p.score}/100` : ""}).`;
}

export function webhookBody(event: HookEvent, workspaceName: string, p: HookPost | null, link: string | null): string {
  return JSON.stringify({
    event,
    sent_at: new Date().toISOString(),
    workspace: workspaceName,
    post: p ? { id: p.id, title: p.title, brand: p.brand, channel: p.channel, status: p.status, approved: p.status === "approved", score: p.score, url: link } : null,
  });
}

/**
 * Tell the outside world about a step in the approval flow. Runs after the response is sent, never throws,
 * and writes what happened to the delivery log.
 *  - the webhook hears "post.approved" (the signal a scheduling tool waits for)
 *  - Slack hears every step where a post needs someone
 */
export async function notify(workspace: { id: string; name: string }, event: HookEvent, p: HookPost | null, origin: string): Promise<void> {
  try {
    const link = p ? `${origin}/posts/${p.id}` : null;
    if (workspace.id === DEMO_WORKSPACE) {
      // the shared demo sends nothing anywhere; the log shows what a real workspace would send
      if (event === "post.approved") await log({ workspace_id: workspace.id, kind: "webhook", event, post: p, target: "demo (not sent)", ok: true, detail: "In the demo nothing is sent. In your own workspace this goes to your webhook address." });
      if (event !== "test") await log({ workspace_id: workspace.id, kind: "slack", event, post: p, target: "demo (not sent)", ok: true, detail: slackText(event, p, null).replace(/:[a-z0-9_]+: /, "") });
      return;
    }
    const s = await hookSettings(workspace.id);
    const jobs: Promise<void>[] = [];
    if (s.webhookUrl && (event === "post.approved" || event === "test")) {
      jobs.push(
        (async () => {
          const target = new URL(s.webhookUrl!).hostname;
          const allowed = await checkHookUrl(s.webhookUrl!);
          if (!allowed.ok) return log({ workspace_id: workspace.id, kind: "webhook", event, post: p, target, ok: false, detail: allowed.reason });
          const body = webhookBody(event, workspace.name, p, link);
          const r = await post(s.webhookUrl!, body, { "x-brandsentinel-event": event, ...(s.webhookSecret ? { "x-brandsentinel-signature": sign(s.webhookSecret, body) } : {}) });
          await log({ workspace_id: workspace.id, kind: "webhook", event, post: p, target, ...r });
        })(),
      );
    }
    if (s.slackUrl && isSlackHook(s.slackUrl)) {
      jobs.push(
        (async () => {
          const r = await post(s.slackUrl!, JSON.stringify({ text: slackText(event, p, link) }), {});
          await log({ workspace_id: workspace.id, kind: "slack", event, post: p, target: "Slack", ...r });
        })(),
      );
    }
    await Promise.all(jobs);
  } catch (e) {
    console.error("[hooks] notify failed", e);
  }
}
