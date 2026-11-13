"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { restartApp, useMe, type Me } from "@/lib/client/use-me";
import { send } from "@/lib/client/send";
import type { Role } from "@/lib/types";
import { ROLE_INFO } from "@/lib/roles";
import { ROLE_HINT, ROLE_LABEL, useRole } from "./role-provider";
import { switchBrand, useBrand } from "@/lib/client/use-brand";
import { resetPosts, usePosts, waitingFor } from "@/lib/client/use-posts";
import { ROLE_DOT } from "./role-note";
import { Button, Count, Dialog } from "./ui";

const NAV = [
  { href: "/", label: "Check a post" },
  { href: "/queue", label: "Review queue" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/facts", label: "Fact Bank" },
  { href: "/insights", label: "Insights" },
  { href: "/workspace", label: "Team" },
];

// pages about the account itself: no brand bar, because they are not about a brand
const ACCOUNT_PAGES = ["/login", "/signup", "/join", "/welcome"];

const ROLES: Role[] = ["creator", "expert", "brand_manager"];

/** What each role has waiting: posts for them, and (brand manager) drafted rules to review. */
function useTodo() {
  const { rows } = usePosts();
  const brand = useBrand();
  const drafts = (brand?.rules ?? []).filter((r) => r.status === "draft").length;
  const posts = (role: Role) => (rows ?? []).filter((p) => waitingFor(role, p)).length;
  return { ready: !!rows, posts, drafts };
}

// usePathname reads the URL, so it sits inside Suspense: dynamic pages like /posts/[id] still get a static shell.
function CurrentNav() {
  return <MainNav path={usePathname()} />;
}

function MainNav({ path }: { path: string | null }) {
  const { role } = useRole();
  const todo = useTodo();
  const badge: Record<string, number> = { "/queue": todo.ready ? todo.posts(role) : 0, "/rulebook": role === "brand_manager" ? todo.drafts : 0 };
  return (
    <nav aria-label="Main" className="thin-scroll -mb-px flex gap-5 overflow-x-auto text-[14px]">
      {NAV.map((n) => {
        const active = path !== null && (n.href === "/" ? path === "/" : path.startsWith(n.href) || (n.href === "/queue" && path.startsWith("/posts")));
        const b = badge[n.href] ?? 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 font-medium transition-colors ${active ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {n.label}
            {b > 0 && (
              <span aria-label={`${b} waiting for you`}>
                <Count n={b} tone="alert" />
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** The brand mark: a proof caret over a baseline, the mark an editor uses to say "something goes here". */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect width="26" height="26" rx="7" fill="var(--color-ink)" />
      <path d="M7.5 15.5 13 8.5l5.5 7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 19h12" stroke="var(--color-pass-bg)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Who does what, and what's waiting for each person. Opened from the role bar. */
function RoleGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, setRole, fixed } = useRole();
  const signedIn = !!useMe()?.signed_in;
  const todo = useTodo();
  const waiting = (r: Role) => {
    const n = todo.posts(r);
    const parts = [r === "creator" ? `${n} post${n === 1 ? "" : "s"} to fix or submit` : `${n} post${n === 1 ? "" : "s"} waiting for approval`];
    if (r === "brand_manager" && todo.drafts) parts.push(`${todo.drafts} drafted rule${todo.drafts === 1 ? "" : "s"} to review`);
    return parts.join(" · ");
  };
  return (
    <Dialog open={open} onClose={onClose} title="Who does what" wide>
      <p className="text-[14px] text-ink-soft">
        Three people share the work, and each step is locked to the person who owns it.{" "}
        {fixed
          ? "You are signed in with one role, set by your brand manager."
          : signedIn
            ? "As a brand manager you can also cover the creator and expert roles when the team is small. Whatever you do is recorded under your own name."
            : "You are in the open demo without signing in, so you can switch roles to play each one."}
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-soft" aria-label="How a post moves">
        <li className="rounded-md bg-paper px-2 py-1">Creator writes and fixes</li>
        <li aria-hidden="true">→</li>
        <li className="rounded-md bg-paper px-2 py-1">Expert signs off claims (only when needed)</li>
        <li aria-hidden="true">→</li>
        <li className="rounded-md bg-paper px-2 py-1">Brand manager gives final approval</li>
      </ol>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => {
          const info = ROLE_INFO[r];
          const on = r === role;
          return (
            <li key={r} className={`flex flex-col rounded-xl border p-4 ${on ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line"}`}>
              <p className="flex items-center gap-2 text-[15px] font-bold">
                <span className={`size-2 rounded-full ${ROLE_DOT[r]}`} aria-hidden="true" />
                {info.label}
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">{info.summary}</p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Does</p>
              <ul className="mt-1 space-y-1 text-[13px]">
                {info.does.map((d) => (
                  <li key={d} className="flex gap-1.5">
                    <span className="text-pass" aria-hidden="true">
                      ✓
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Doesn&apos;t</p>
              <ul className="mt-1 space-y-1 text-[13px] text-ink-soft">
                {info.doesNot.map((d) => (
                  <li key={d} className="flex gap-1.5">
                    <span aria-hidden="true">–</span>
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg bg-paper px-2.5 py-1.5 text-[12px] font-medium">{todo.ready ? waiting(r) : "Loading what's waiting…"}</p>
              <div className="mt-3 pt-1 [&]:mt-auto">
                {on ? (
                  <p className="pt-3 text-[13px] font-semibold text-pass">{fixed ? "This is your role" : "You're playing this role"}</p>
                ) : fixed ? null : (
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => {
                      setRole(r);
                      onClose();
                    }}
                  >
                    Switch to {info.short}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

/** The open demo (not signed in): everyone can play every person in the approval flow. */
function RoleSwitcher() {
  const { role, setRole, name, setName } = useRole();
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <div role="group" aria-label="Acting as" className="flex rounded-lg border border-line-strong bg-paper p-0.5">
        {ROLES.map((r) => {
          const on = r === role;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              title={ROLE_HINT[r]}
              onClick={() => setRole(r)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors ${on ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              <span className={`size-1.5 rounded-full ${ROLE_DOT[r]}`} aria-hidden="true" />
              {ROLE_INFO[r].short}
            </button>
          );
        })}
      </div>
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} .'_-]/gu, ""))}
        className="hidden w-24 rounded-lg border border-line-strong bg-surface px-2 py-1 font-medium sm:block"
        aria-label={`Your name as ${ROLE_LABEL[role]}`}
      />
    </div>
  );
}

/** A brand manager of a real workspace can cover the creator and expert roles; their name stays on everything. */
function ActingAs() {
  const { role, setRole } = useRole();
  return (
    <label className="flex items-center gap-1.5 text-[13px]">
      <span className="hidden text-ink-soft sm:inline">Acting as</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        title="As brand manager you can also cover the creator and expert roles. Your name is recorded on everything you do."
        aria-label="Acting as"
        className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 font-semibold"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_INFO[r].short}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Top right: who you are. Signed in: your name, role and workspace. Not signed in: the role switcher and Sign in. */
function AccountArea() {
  const me = useMe();
  const [busy, setBusy] = useState(false);
  if (!me) return <span className="inline-block h-8 w-56 animate-pulse rounded-lg bg-line/70" aria-hidden="true" />;
  if (!me.signed_in) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <RoleSwitcher />
        <Link href="/login" className="inline-flex h-8 items-center whitespace-nowrap rounded-lg bg-ink px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-[#26304a]">
          Sign in
        </Link>
      </div>
    );
  }
  const signOut = async () => {
    setBusy(true);
    await send("/api/auth/signout", "POST", {}).catch(() => undefined);
    restartApp("/");
  };
  const others = me.workspaces.filter((w) => w.id !== me.workspace?.id);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {me.can_switch && <ActingAs />}
      <AccountMenu me={me} others={others} busy={busy} setBusy={setBusy} signOut={signOut} />
    </div>
  );
}

function AccountMenu({ me, others, busy, setBusy, signOut }: { me: Me; others: Me["workspaces"]; busy: boolean; setBusy: (b: boolean) => void; signOut: () => void }) {
  const { role } = useRole();
  return (
    <details className="group relative text-[13px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 font-semibold hover:border-ink-faint [&::-webkit-details-marker]:hidden">
        {me.role && me.role !== "guest" && <span className={`size-2 shrink-0 rounded-full ${ROLE_DOT[role]}`} aria-hidden="true" />}
        <span className="max-w-[9rem] truncate">{me.name ?? me.email}</span>
        <span className="hidden font-normal text-ink-soft sm:inline">{me.role && me.role !== "guest" ? ROLE_INFO[role].short : ""}</span>
        <span aria-hidden="true" className="text-ink-faint transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-40 mt-1.5 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg">
        <p className="truncate font-semibold">{me.name}</p>
        <p className="truncate text-ink-soft">{me.email}</p>
        {me.workspace && (
          <p className="mt-2 rounded-lg bg-paper px-2.5 py-1.5">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Workspace</span>
            <span className="block truncate font-semibold">{me.workspace.name}</span>
            {me.role && me.role !== "guest" && <span className="block text-ink-soft">Your role: {ROLE_INFO[role].label}</span>}
          </p>
        )}
        {others.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Switch workspace</p>
            <ul className="mt-1">
              {others.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full truncate rounded-md px-2 py-1 text-left font-medium hover:bg-paper"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await send("/api/workspace/switch", "POST", { workspace_id: w.id });
                        restartApp("/");
                      } catch {
                        setBusy(false);
                      }
                    }}
                  >
                    {w.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <Link href="/workspace" className="font-semibold text-ink underline-offset-4 hover:underline">
            Team and AI key
          </Link>
          <Button size="sm" onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </Button>
        </div>
        {me.demo_account && <p className="mt-2 text-[12px] text-ink-soft">This is a shared demo account. Sign out to switch roles freely, or create your own workspace.</p>}
      </div>
    </details>
  );
}

/** Which brand's rules, facts and posts you are working on. Kept in a cookie so every API call uses it. */
function BrandSwitcher() {
  const live = useBrand();
  const [busy, setBusy] = useState<string | null>(null);
  // keep showing the menu while the next brand loads, instead of flashing an empty box
  const [last, setLast] = useState(live);
  if (live && live !== last) setLast(live);
  const data = live ?? last;
  if (!data) return <span className="inline-block h-8 w-44 animate-pulse rounded-lg bg-line/70" aria-hidden="true" />;
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Brand</span>
        <select
          value={busy ?? data.brand.slug}
          disabled={!!busy}
          aria-busy={!!busy}
          onChange={async (e) => {
            setBusy(e.target.value);
            await switchBrand(e.target.value, resetPosts);
            setBusy(null);
          }}
          className="max-w-[14rem] rounded-lg border border-line-strong bg-surface px-2 py-1 text-[14px] font-semibold text-ink"
        >
          {(data.brands?.length ? data.brands : [{ slug: data.brand.slug, name: data.brand.name }]).map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <Link href="/brands" className="whitespace-nowrap text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
        Manage brands
      </Link>
    </div>
  );
}

/** Under the header: the brand being worked on and what the current role is for. */
function RoleBar() {
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a per-visitor flag once, after hydration
      setSeen(localStorage.getItem("bs-guide-seen") === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const show = () => {
    setOpen(true);
    setSeen(true);
    try {
      localStorage.setItem("bs-guide-seen", "1");
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 text-[13px] text-ink-soft sm:px-6">
      <BrandSwitcher />
      <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
      <span className="flex-1 sm:hidden" aria-hidden="true" />
      <p className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
        <span className={`size-1.5 shrink-0 rounded-full ${ROLE_DOT[role]}`} aria-hidden="true" />
        <span className="truncate">
          <strong className="font-semibold text-ink">{ROLE_LABEL[role]}:</strong> {ROLE_INFO[role].summary}
        </span>
      </p>
      <button type="button" onClick={show} className="relative inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1 font-semibold text-ink hover:border-ink-faint">
        {!seen && (
          <span className="absolute -right-1 -top-1 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-low opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-low" />
          </span>
        )}
        Who does what?
      </button>
      <RoleGuide open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** A signed-in person with no workspace yet is sent to create one. */
function NeedsWorkspace() {
  const me = useMe();
  useEffect(() => {
    if (me?.signed_in && !me.workspace && !ACCOUNT_PAGES.some((p) => window.location.pathname === p || window.location.pathname.startsWith(`${p}/`))) window.location.replace("/welcome");
  }, [me]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="z-30 border-b lg:sticky lg:top-0 border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 pt-3 sm:px-6 lg:flex-nowrap lg:pt-0">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold tracking-tight lg:py-3">
            <Mark />
            BrandSentinel
          </Link>
          <div className="order-last w-full min-w-0 lg:order-none lg:w-auto lg:flex-1">
            <Suspense fallback={<MainNav path={null} />}>
              <CurrentNav />
            </Suspense>
          </div>
          <div className="ml-auto lg:py-2.5">
            <AccountArea />
          </div>
        </div>
      </header>
      {/* hidden by CSS on account pages (sign in, sign up, join), which are not about a brand */}
      <div className="brand-bar">
        <RoleBar />
      </div>
      <NeedsWorkspace />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-5 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-[13px] text-ink-soft sm:px-6">
          <p>BrandSentinel by Team O(1). Demo brands are fictional. AI checks use the Gemini API, and every AI finding is checked against real rules and facts before it&apos;s shown.</p>
          <p className="flex gap-4">
            <a href="/tests" className="font-medium text-ink underline-offset-4 hover:underline">
              Test results
            </a>
            <a href="https://github.com/lakshay-modi/BrandSentinel" target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline-offset-4 hover:underline">
              Source code
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
