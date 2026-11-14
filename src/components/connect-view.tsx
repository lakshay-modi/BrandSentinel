"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { send } from "@/lib/client/send";
import { Button, ErrorNote, PageSkeleton, timeAgo } from "./ui";
import { useToast } from "./toast";

interface Token {
  id: string;
  name: string;
  hint: string;
  created_by_name: string;
  created_at: string;
  last_used_at: string | null;
}
interface Delivery {
  id: number;
  kind: "webhook" | "slack";
  event: string;
  post_id: string | null;
  post_title: string;
  target: string;
  ok: boolean;
  status: number | null;
  ms: number | null;
  detail: string;
  created_at: string;
}
interface Data {
  workspace: { id: string; name: string; isDemo: boolean };
  can_manage: boolean;
  api_base: string;
  demo_token: string | null;
  brands: { slug: string; name: string }[];
  tokens: Token[];
  webhook: { host: string; signed: boolean } | null;
  slack: boolean;
  deliveries: Delivery[];
}

const EVENT_LABEL: Record<string, string> = {
  "post.submitted": "Post submitted for review",
  "post.expert_approved": "Expert approved",
  "post.changes_requested": "Changes requested",
  "post.approved": "Post approved",
  test: "Test",
};

function Section({ id, title, lead, children }: { id?: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
      {lead && <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-1.5 text-[14px] leading-relaxed">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-paper text-[12px] font-bold">{i + 1}</span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="thin-scroll overflow-x-auto rounded-lg bg-ink px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-white">{children}</pre>;
}

function CopyField({ value, label, secret }: { value: string; label: string; secret?: boolean }) {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <input readOnly aria-label={label} value={value} type={secret ? "password" : "text"} onFocus={(e) => e.currentTarget.select()} className="field !mt-0 min-w-0 flex-1 font-mono text-[12.5px]" />
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(`${label} copied`);
          } catch {
            toast("Couldn't copy. Select the text and copy it by hand.", "error");
          }
        }}
      >
        Copy
      </Button>
    </div>
  );
}

export function ConnectView() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [slackUrl, setSlackUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/connections");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't load this page");
      setData(body as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the page's data once
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(null);
    }
  };
  const copyFile = async (path: string, what: string) => {
    try {
      const text = await (await fetch(path)).text();
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Couldn't copy. Download the zip instead.", "error");
    }
  };

  if (error && !data) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageSkeleton rows={4} />;
  const { workspace, can_manage: canManage } = data;
  const token = newToken ?? data.demo_token ?? "bs_YOUR_TOKEN";
  const brand = data.brands[0]?.slug ?? "your-brand";
  const ownOnly = workspace.isDemo ? "The shared demo sends nothing outside, so this is switched off here. " : "Only a brand manager can change this. ";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Connect</h1>
        <p className="mt-1 max-w-3xl text-[15px] text-ink-soft">
          Check content where it is written, and tell other tools when a post is approved. Everything here is free: no paid store listing, no paid plan.
        </p>
        <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
          {[
            ["#token", "1. Token"],
            ["#extension", "2. Browser extension"],
            ["#docs", "3. Google Docs add-on"],
            ["#webhook", "4. “Post approved” signal"],
            ["#slack", "5. Slack"],
            ["#log", "What was sent"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full border border-line-strong bg-surface px-3 py-1 hover:border-ink-faint">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section
        id="token"
        title="1. Token"
        lead="The extension, the add-on and other tools prove which workspace they act for with a token. A check made with a token uses that workspace's rules and Fact Bank."
      >
        {data.demo_token ? (
          <div className="space-y-2">
            <p className="text-[14px]">
              <strong className="font-semibold">Demo token.</strong> It is public on purpose and already filled in when you install the extension or the add-on. It checks against the demo&apos;s fictional brands.
            </p>
            <CopyField value={data.demo_token} label="Demo token" />
            <p className="text-[13px] text-ink-soft">
              For your own brands,{" "}
              <Link href="/signup" className="font-semibold text-ink underline underline-offset-2">
                create a workspace
              </Link>{" "}
              and make private tokens here.
            </p>
          </div>
        ) : canManage ? (
          <>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void run("token", async () => {
                  const res = await send<{ token: string }>("/api/workspace/tokens", "POST", { name: tokenName });
                  setNewToken(res.token);
                  setTokenName("");
                  await load();
                });
              }}
            >
              <label className="block min-w-[14rem] flex-1">
                <span className="field-label">Name (who or what will use it)</span>
                <input className="field" maxLength={60} placeholder="For example: Riya's browser" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
              </label>
              <Button variant="primary" type="submit" disabled={busy === "token" || tokenName.trim().length < 2}>
                {busy === "token" ? "Creating…" : "Create token"}
              </Button>
            </form>
            {newToken && (
              <div className="mt-4 rounded-lg border border-pass/40 bg-pass-bg/60 p-3.5">
                <p className="mb-2 text-[13px] font-semibold">Your new token. Copy it now: it is not shown again.</p>
                <CopyField value={newToken} label="Token" />
              </div>
            )}
            {data.tokens.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {data.tokens.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]">
                    <span className="font-semibold">{t.name}</span>
                    <span className="font-mono text-ink-soft">{t.hint}</span>
                    <span className="min-w-0 flex-1 text-ink-soft">
                      created {timeAgo(t.created_at)} by {t.created_by_name || "a manager"} · {t.last_used_at ? `last used ${timeAgo(t.last_used_at)}` : "not used yet"}
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!!busy}
                      onClick={() =>
                        run(`del-${t.id}`, async () => {
                          await send(`/api/workspace/tokens/${t.id}`, "DELETE", {});
                          toast("Token deleted: whatever used it stops working");
                          await load();
                        })
                      }
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-[14px] text-ink-soft">A brand manager creates tokens. Ask yours for one, then paste it into the extension or the add-on.</p>
        )}
      </Section>

      <Section
        id="extension"
        title="2. Browser extension: check as you write, on any website"
        lead="A small panel shows the score and each problem while you type in Instagram, LinkedIn, a scheduling tool or any other site. It reads only the text box you are typing in, and only after you switch it on for that page."
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <Steps
            items={[
              <>Download the extension and unzip it.</>,
              <>
                In Chrome or Edge open <code className="rounded bg-paper px-1 font-mono text-[12.5px]">chrome://extensions</code>, turn on <strong className="font-semibold">Developer mode</strong> (top right), click{" "}
                <strong className="font-semibold">Load unpacked</strong> and choose the unzipped <code className="rounded bg-paper px-1 font-mono text-[12.5px]">extension</code> folder.
              </>,
              <>Open the site you write on, click the text box, then click the BrandSentinel icon and “Check what I&apos;m writing on this page”.</>,
              <>
                Type. Problems appear as you write. “Apply fix” changes the text, “Full check with AI” adds the AI check, and “Save as draft” sends the post into this workspace&apos;s Review queue.
              </>,
            ]}
          />
          <div className="flex flex-col gap-2">
            <a href="/downloads/brandsentinel-extension.zip" download className="inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-[14px] font-semibold text-white shadow-sm hover:bg-[#26304a]">
              Download the extension
            </a>
            <span className="max-w-[15rem] text-[12px] text-ink-soft">17 KB zip. It is loaded straight from the folder, so there is no store listing and no fee.</span>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-ink-soft">
          {data.demo_token ? "It comes set up for this demo." : "In the extension's Connection settings, paste your token."} “Apply fix” works in plain text boxes; in rich editors (for example LinkedIn) the fix is shown for you to
          type.
        </p>
      </Section>

      <Section
        id="docs"
        title="3. Google Docs add-on: check a draft in the document"
        lead="A sidebar in Google Docs checks the document, or just the part you select, and re-checks every few seconds while you write. “Apply fix” edits the document."
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <Steps
            items={[
              <>
                In your Google Doc choose <strong className="font-semibold">Extensions → Apps Script</strong>.
              </>,
              <>
                Replace everything in <code className="rounded bg-paper px-1 font-mono text-[12.5px]">Code.gs</code> with the copied Code.gs.
              </>,
              <>
                Click <strong className="font-semibold">+ → HTML</strong>, name the file <code className="rounded bg-paper px-1 font-mono text-[12.5px]">Sidebar</code>, and replace its content with the copied Sidebar.html. Save.
              </>,
              <>
                Reload the document, then choose <strong className="font-semibold">BrandSentinel → Check this document</strong>. The first time, Google asks you to allow it to read this document and contact the
                BrandSentinel server.
              </>,
            ]}
          />
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => copyFile("/downloads/google-docs-addon/Code.gs.txt", "Code.gs")}>
              Copy Code.gs
            </Button>
            <Button onClick={() => copyFile("/downloads/google-docs-addon/Sidebar.html.txt", "Sidebar.html")}>Copy Sidebar.html</Button>
            <a href="/downloads/brandsentinel-google-docs-addon.zip" download className="text-center text-[13px] font-semibold text-ink underline underline-offset-2">
              or download both as a zip
            </a>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-ink-soft">
          This is the free way to install a Docs add-on for yourself or your team. A one-click listing in Google&apos;s store is on the roadmap; it needs Google&apos;s review, not money.
        </p>
      </Section>

      <Section
        id="webhook"
        title="4. “Post approved” signal for scheduling tools"
        lead="When the brand manager approves a post, BrandSentinel sends one HTTPS request to your address. Point it at your scheduler, or at a free Zapier or Make step, so a post goes out only after it is approved. A tool can also ask at any time whether a post is approved."
      >
        {canManage ? (
          <>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("webhook", async () => {
                  const res = await send<{ secret?: string }>("/api/workspace/hooks", "PUT", { kind: "webhook", url: webhookUrl.trim() });
                  setSecret(res.secret ?? null);
                  setWebhookUrl("");
                  toast("Webhook address saved");
                  await load();
                });
              }}
            >
              <label className="block min-w-[16rem] flex-1">
                <span className="field-label">{data.webhook ? `Sending to ${data.webhook.host}. Replace with another address` : "Your webhook address (https)"}</span>
                <input className="field font-mono" type="url" placeholder="https://hooks.example.com/brandsentinel" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              </label>
              <Button variant="primary" type="submit" disabled={busy === "webhook" || !webhookUrl.trim()}>
                {busy === "webhook" ? "Checking…" : "Save address"}
              </Button>
              {data.webhook && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={!!busy}
                  onClick={() =>
                    run("webhook-remove", async () => {
                      await send("/api/workspace/hooks", "PUT", { kind: "webhook", url: "" });
                      setSecret(null);
                      toast("Webhook removed");
                      await load();
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </form>
            {secret && (
              <div className="mt-4 rounded-lg border border-pass/40 bg-pass-bg/60 p-3.5">
                <p className="mb-2 text-[13px] font-semibold">Signing secret. Copy it now: it is not shown again. Your receiver uses it to check that a request really came from BrandSentinel.</p>
                <CopyField value={secret} label="Signing secret" />
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-paper px-3.5 py-2.5 text-[14px] text-ink-soft">
            {ownOnly}
            {workspace.isDemo && (
              <>
                Approve a demo post and the log below shows exactly what would be sent.{" "}
                <Link href="/signup" className="font-semibold text-ink underline underline-offset-2">
                  Create a workspace
                </Link>{" "}
                to send it to a real address.
              </>
            )}
          </p>
        )}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-semibold">What is sent (POST, JSON)</p>
            <Code>{`{
  "event": "post.approved",
  "sent_at": "2026-11-15T09:30:00.000Z",
  "workspace": "${workspace.name}",
  "post": {
    "id": "…", "title": "…", "brand": "…",
    "channel": "instagram",
    "status": "approved", "approved": true,
    "score": 100, "url": "${data.api_base}/posts/…"
  }
}

Headers:
  X-BrandSentinel-Event: post.approved
  X-BrandSentinel-Signature: sha256=<HMAC of the body>`}</Code>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-semibold">Or ask: is this post approved?</p>
            <Code>{`curl ${data.api_base}/api/v1/posts/POST_ID \\
  -H "Authorization: Bearer ${token}"

→ { "status": "approved", "approved": true,
    "approved_by": "…", "approved_at": "…" }`}</Code>
            <p className="mb-1.5 mt-3 text-[13px] font-semibold">Check any text from your own tool</p>
            <Code>{`curl -X POST ${data.api_base}/api/v1/check \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"We are the BEST!!!","brand":"${brand}"}'`}</Code>
          </div>
        </div>
      </Section>

      <Section
        id="slack"
        title="5. Slack: hear when a post needs someone"
        lead="BrandSentinel posts in one Slack channel when a post is submitted for review, when the expert has approved and the brand manager is next, when changes are requested, and when a post is approved. It uses Slack's free incoming webhooks."
      >
        {canManage ? (
          <>
            <Steps
              items={[
                <>
                  In Slack, create an incoming webhook for the channel (
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">
                    Slack&apos;s guide
                  </a>
                  ) and copy its address.
                </>,
                <>Paste it here and save. Then send a test.</>,
              ]}
            />
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("slack", async () => {
                  await send("/api/workspace/hooks", "PUT", { kind: "slack", url: slackUrl.trim() });
                  setSlackUrl("");
                  toast("Slack connected");
                  await load();
                });
              }}
            >
              <label className="block min-w-[16rem] flex-1">
                <span className="field-label">{data.slack ? "Slack is connected. Replace with another webhook address" : "Slack incoming webhook address"}</span>
                <input className="field font-mono" type="password" autoComplete="off" placeholder="https://hooks.slack.com/services/…" value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} />
              </label>
              <Button variant="primary" type="submit" disabled={busy === "slack" || !slackUrl.trim()}>
                {busy === "slack" ? "Saving…" : "Save"}
              </Button>
              {data.slack && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={!!busy}
                  onClick={() =>
                    run("slack-remove", async () => {
                      await send("/api/workspace/hooks", "PUT", { kind: "slack", url: "" });
                      toast("Slack disconnected");
                      await load();
                    })
                  }
                >
                  Disconnect
                </Button>
              )}
            </form>
          </>
        ) : (
          <p className="rounded-lg bg-paper px-3.5 py-2.5 text-[14px] text-ink-soft">
            {ownOnly}
            {workspace.isDemo && "Submit or approve a demo post and the log below shows the message Slack would get."}
          </p>
        )}
      </Section>

      <Section id="log" title="What was sent" lead="The last 20 signals, newest first, with what came back.">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {canManage && (data.webhook || data.slack) && (
            <Button
              disabled={!!busy}
              onClick={() =>
                run("test", async () => {
                  const res = await send<{ deliveries: Delivery[] }>("/api/workspace/hooks/test", "POST", {});
                  const failed = res.deliveries.filter((d) => !d.ok);
                  toast(failed.length ? `Test failed: ${failed[0].detail}` : "Test delivered", failed.length ? "error" : "success");
                  await load();
                })
              }
            >
              {busy === "test" ? "Sending…" : "Send a test now"}
            </Button>
          )}
          <Button size="sm" onClick={() => run("reload", load)} disabled={!!busy}>
            Refresh
          </Button>
        </div>
        {data.deliveries.length === 0 ? (
          <p className="text-[14px] text-ink-soft">Nothing yet. Submit a post for review or approve one, then come back.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.deliveries.map((d) => (
              <li key={d.id} className="grid gap-x-3 gap-y-0.5 py-2.5 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                <span className={`h-fit w-fit rounded-full px-2 py-0.5 text-[12px] font-semibold ${d.ok ? "bg-pass-bg text-pass" : "bg-high-bg text-high"}`}>{d.ok ? "Sent" : "Failed"}</span>
                <span className="min-w-0">
                  <span className="font-semibold">{EVENT_LABEL[d.event] ?? d.event}</span> <span className="text-ink-soft">→ {d.kind === "slack" ? (d.target === "Slack" ? "Slack" : `Slack · ${d.target}`) : `Webhook · ${d.target}`}</span>
                  {d.post_id && (
                    <>
                      {" · "}
                      <Link href={`/posts/${d.post_id}`} className="font-medium text-ink underline underline-offset-2">
                        {d.post_title || "the post"}
                      </Link>
                    </>
                  )}
                  <span className="block text-ink-soft">
                    {d.detail}
                    {d.status ? ` (HTTP ${d.status}${d.ms !== null ? `, ${d.ms} ms` : ""})` : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap text-ink-faint">{timeAgo(d.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
