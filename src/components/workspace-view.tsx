"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Role } from "@/lib/types";
import { ROLE_INFO } from "@/lib/roles";
import { send } from "@/lib/client/send";
import { reloadMe, restartApp } from "@/lib/client/use-me";
import { ROLE_DOT } from "./role-note";
import { Button, ConfirmDialog, ErrorNote, PageSkeleton, timeAgo } from "./ui";
import { useToast } from "./toast";

const ROLES: Role[] = ["creator", "expert", "brand_manager"];

interface Member {
  user_id: string;
  role: Role;
  name: string;
  email: string;
  created_at: string;
  you: boolean;
}
interface Invite {
  id: string;
  role: Role;
  note: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_name: string | null;
}
interface Data {
  workspace: { id: string; name: string; isDemo: boolean };
  you: { user_id: string; role: Role | "guest"; signed_in: boolean; demo_account: boolean };
  can_manage: boolean;
  members: Member[];
  invites: Invite[];
  ai: { source: "own" | "shared" | "none"; hint: string | null; unreadable: boolean; can_store: boolean };
}

function Section({ title, lead, children }: { title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
      {lead && <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RoleTag({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-paper px-2 py-0.5 text-[12px] font-semibold">
      <span className={`size-1.5 rounded-full ${ROLE_DOT[role]}`} aria-hidden="true" />
      {ROLE_INFO[role].label}
    </span>
  );
}

function inviteState(i: Invite): { label: string; cls: string } {
  if (i.used_at) return { label: `Joined${i.used_by_name ? `: ${i.used_by_name}` : ""}`, cls: "bg-pass-bg text-pass" };
  if (new Date(i.expires_at).getTime() < Date.now()) return { label: "Expired", cls: "bg-paper text-ink-soft" };
  return { label: "Waiting", cls: "bg-low-bg text-low" };
}

export function WorkspaceView() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ role: Role; note: string }>({ role: "creator", note: "" });
  const [link, setLink] = useState<{ url: string; role: Role } | null>(null);
  const [remove, setRemove] = useState<Member | null>(null);
  const [aiKey, setAiKey] = useState("");
  const [rename, setRename] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't load the workspace");
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

  /** Run one change; show the server's plain message if it refuses. */
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

  if (error && !data) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageSkeleton rows={4} />;
  const { workspace, can_manage: canManage, ai } = data;

  const createInvite = (e: FormEvent) => {
    e.preventDefault();
    void run("invite", async () => {
      const res = await send<{ link: string }>("/api/workspace/invites", "POST", invite);
      setLink({ url: res.link, role: invite.role });
      setInvite((i) => ({ ...i, note: "" }));
      await load();
    });
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast("Invite link copied");
    } catch {
      toast("Couldn't copy. Select the link and copy it by hand.", "error");
    }
  };
  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    void run("ai", async () => {
      await send("/api/workspace/ai-key", "PUT", { key: aiKey.trim() });
      setAiKey("");
      toast("Your AI key is connected");
      await load();
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Team</h1>
          <p className="mt-1 text-[15px] text-ink-soft">
            {workspace.isDemo ? "The demo workspace: open to everyone, with fictional brands." : <>The people in <strong className="font-semibold text-ink">{workspace.name}</strong>, their roles, and the workspace&apos;s AI key.</>}
          </p>
        </div>
        {canManage &&
          (rename === null ? (
            <Button size="sm" onClick={() => setRename(workspace.name)}>
              Rename workspace
            </Button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run("rename", async () => {
                  await send("/api/workspace", "PATCH", { name: rename });
                  setRename(null);
                  toast("Workspace renamed");
                  await Promise.all([load(), reloadMe()]);
                });
              }}
            >
              <input className="field !mt-0 !h-8 w-56" aria-label="Workspace name" maxLength={80} value={rename} onChange={(e) => setRename(e.target.value)} autoFocus />
              <Button size="sm" variant="primary" type="submit" disabled={busy === "rename" || rename.trim().length < 2}>
                Save
              </Button>
              <Button size="sm" type="button" onClick={() => setRename(null)}>
                Cancel
              </Button>
            </form>
          ))}
      </header>

      {workspace.isDemo && (
        <Section
          title="This is the shared demo"
          lead="Anyone can open it, and without signing in you can switch between all three roles. It has no invites and uses BrandSentinel's shared AI key, so it holds only fictional brands."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/signup" className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-[14px] font-semibold text-white shadow-sm hover:bg-[#26304a]">
              Create your own workspace
            </Link>
            <p className="text-[13px] text-ink-soft">Your own workspace is private to the people you invite, and you can connect your own AI key.</p>
          </div>
        </Section>
      )}

      <Section
        title={`People (${data.members.length})`}
        lead={
          workspace.isDemo
            ? "The ready-made demo accounts. Each one holds a single role, as a real team member does."
            : canManage
              ? "Each person has one role. The server and the database both enforce it: a creator can't approve, and nobody outside this workspace can see anything in it."
              : "Each person has one role, set by a brand manager."
        }
      >
        <ul className="divide-y divide-line">
          {data.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">
                  {m.name || m.email || "Member"} {m.you && <span className="font-normal text-ink-soft">(you)</span>}
                </p>
                <p className="truncate text-[13px] text-ink-soft">{m.email}</p>
              </div>
              {canManage ? (
                <>
                  <select
                    aria-label={`Role of ${m.name || m.email}`}
                    className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-[13px] font-semibold"
                    value={m.role}
                    disabled={!!busy}
                    onChange={(e) =>
                      run(`role-${m.user_id}`, async () => {
                        await send(`/api/workspace/members/${m.user_id}`, "PATCH", { role: e.target.value });
                        toast(`${m.name || "Member"} is now ${ROLE_INFO[e.target.value as Role].label}`);
                        await Promise.all([load(), m.you ? reloadMe() : Promise.resolve()]);
                      })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_INFO[r].label}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="danger" disabled={!!busy} onClick={() => setRemove(m)}>
                    Remove
                  </Button>
                </>
              ) : (
                <RoleTag role={m.role} />
              )}
            </li>
          ))}
        </ul>
      </Section>

      {canManage && (
        <Section title="Invite someone" lead="Choose their role and send them the link. Each link works for one person and for 7 days. No email is sent: you share the link yourself.">
          <form onSubmit={createInvite} className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="field-label">Role</span>
              <select className="field" value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value as Role }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_INFO[r].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[12rem] flex-1">
              <span className="field-label">Who is it for? (optional)</span>
              <input className="field" maxLength={80} placeholder="For example: Riya, design team" value={invite.note} onChange={(e) => setInvite((i) => ({ ...i, note: e.target.value }))} />
            </label>
            <Button variant="primary" type="submit" disabled={busy === "invite"}>
              {busy === "invite" ? "Creating…" : "Create invite link"}
            </Button>
          </form>
          <p className="mt-2 text-[13px] text-ink-soft">{ROLE_INFO[invite.role].label}: {ROLE_INFO[invite.role].summary}</p>

          {link && (
            <div className="mt-4 rounded-lg border border-pass/40 bg-pass-bg/60 p-3.5">
              <p className="text-[13px] font-semibold">Invite link for a {ROLE_INFO[link.role].label}. Copy it now: it is not shown again.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input readOnly className="field !mt-0 min-w-0 flex-1 font-mono text-[12.5px]" value={link.url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="primary" onClick={copy}>
                  Copy link
                </Button>
              </div>
            </div>
          )}

          {data.invites.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {data.invites.map((i) => {
                const st = inviteState(i);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-[13px]">
                    <RoleTag role={i.role} />
                    <span className="min-w-0 flex-1 truncate text-ink-soft">
                      {i.note || "No note"} · created {timeAgo(i.created_at)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>{st.label}</span>
                    {!i.used_at && (
                      <Button
                        size="sm"
                        disabled={!!busy}
                        onClick={() =>
                          run(`cancel-${i.id}`, async () => {
                            await send(`/api/workspace/invites/${i.id}`, "DELETE", {});
                            toast("Invite cancelled: its link no longer works");
                            await load();
                          })
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      <Section
        title="AI key"
        lead="BrandSentinel's AI checks call the Gemini API. A workspace can connect its own Gemini key, so its posts are processed under your company's own Google account and data terms, for example a paid plan where prompts are not used for training."
      >
        <p className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${ai.source === "own" ? "bg-pass-bg text-pass" : ai.source === "shared" ? "bg-med-bg text-med" : "bg-paper text-ink-soft"}`}>
            {ai.source === "own" ? "Your own key" : ai.source === "shared" ? "Shared demo key" : "AI is off"}
          </span>
          <span className="text-ink-soft">
            {ai.source === "own"
              ? `This workspace's AI checks use your key ending ${ai.hint ?? ""}.`
              : ai.source === "shared"
                ? "AI checks use BrandSentinel's shared free-tier key, where Google may use prompts to improve its products. Fine for trying things out; connect your own key before checking confidential content."
                : "No AI key is set, so only the fast checks run."}
          </span>
        </p>
        {ai.unreadable && <p className="mt-2 text-[13px] text-med">The key saved earlier can no longer be read (the server&apos;s secret changed). Enter it again.</p>}
        {canManage ? (
          ai.can_store ? (
            <form onSubmit={saveKey} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block min-w-[16rem] flex-1">
                <span className="field-label">{ai.source === "own" ? "Replace with another Gemini API key" : "Gemini API key"}</span>
                <input className="field font-mono" type="password" autoComplete="off" spellCheck={false} placeholder="Paste the key from Google AI Studio" value={aiKey} onChange={(e) => setAiKey(e.target.value)} />
                <span className="field-hint">It is checked with Google, encrypted before it is stored, and never shown again: only its last 4 characters.</span>
              </label>
              <Button variant="primary" type="submit" disabled={busy === "ai" || aiKey.trim().length < 20}>
                {busy === "ai" ? "Checking the key…" : "Connect key"}
              </Button>
              {ai.source === "own" && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={!!busy}
                  onClick={() =>
                    run("ai-remove", async () => {
                      await send("/api/workspace/ai-key", "DELETE", {});
                      toast("Your key was removed");
                      await load();
                    })
                  }
                >
                  Remove key
                </Button>
              )}
            </form>
          ) : (
            <p className="mt-3 text-[13px] text-ink-soft">This server can&apos;t store keys (no server secret is set).</p>
          )
        ) : (
          !workspace.isDemo && <p className="mt-3 text-[13px] text-ink-soft">Only a brand manager can connect or change the key.</p>
        )}
      </Section>

      {data.you.signed_in && !data.you.demo_account && (
        <p className="text-[13px] text-ink-soft">
          Working with another company or client?{" "}
          <Link href="/welcome" className="font-semibold text-ink underline underline-offset-4">
            Start another workspace
          </Link>
        </p>
      )}

      <ConfirmDialog
        open={!!remove}
        title={`Remove ${remove?.name || remove?.email || "this person"}?`}
        action="Remove"
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          const m = remove;
          setRemove(null);
          if (!m) return;
          await run(`remove-${m.user_id}`, async () => {
            await send(`/api/workspace/members/${m.user_id}`, "DELETE", {});
            toast(`${m.name || "Member"} was removed`);
            if (m.you) restartApp("/");
            else await load();
          });
        }}
      >
        They lose access to this workspace at once. Posts they wrote and the history of what they did are kept.
      </ConfirmDialog>
    </div>
  );
}
