"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL, useRole } from "./role-provider";
import { useBrand } from "@/lib/client/use-brand";

const NAV = [
  { href: "/", label: "Check a post" },
  { href: "/queue", label: "Review queue" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/facts", label: "Fact Bank" },
  { href: "/insights", label: "Insights" },
];

const ROLES: { role: Role; short: string }[] = [
  { role: "creator", short: "Creator" },
  { role: "expert", short: "Expert" },
  { role: "brand_manager", short: "Brand manager" },
];

// usePathname reads the URL, so it sits inside Suspense: dynamic pages like /posts/[id] still get a static shell.
function CurrentNav() {
  return <MainNav path={usePathname()} />;
}

function MainNav({ path }: { path: string | null }) {
  return (
    <nav aria-label="Main" className="-mb-px flex gap-5 overflow-x-auto text-[14px]">
      {NAV.map((n) => {
        const active = path !== null && (n.href === "/" ? path === "/" : path.startsWith(n.href));
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 py-3 font-medium transition-colors ${active ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {n.label}
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

/** Roles are a no-sign-in demo convenience: everyone can play every person in the approval flow. */
function RoleSwitcher() {
  const { role, setRole, name, setName } = useRole();
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <div role="radiogroup" aria-label="Acting as" className="flex rounded-lg border border-line-strong bg-paper p-0.5">
        {ROLES.map((r) => {
          const on = r.role === role;
          return (
            <button
              key={r.role}
              type="button"
              role="radio"
              aria-checked={on}
              title={ROLE_HINT[r.role]}
              onClick={() => setRole(r.role)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors ${on ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {r.short}
            </button>
          );
        })}
      </div>
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} .'_-]/gu, ""))}
        className="w-24 rounded-lg border border-line-strong bg-surface px-2 py-1 font-medium"
        aria-label={`Your name as ${ROLE_LABEL[role]}`}
      />
    </div>
  );
}

/** Which brand's rules, facts and posts you are working on. Kept in a cookie so every API call uses it. */
function BrandSwitcher() {
  const data = useBrand();
  if (!data) return <span className="inline-block h-7 w-36 animate-pulse rounded-lg bg-line/70" aria-hidden="true" />;
  return (
    <label className="flex items-center gap-2">
      <span className="font-medium text-ink">Brand</span>
      <select
        value={data.brand.slug}
        onChange={(e) => {
          document.cookie = `bs-brand=${encodeURIComponent(e.target.value)}; path=/; max-age=31536000; samesite=lax; secure`;
          window.location.reload();
        }}
        className="rounded-lg border border-line-strong bg-surface px-2 py-1 font-semibold text-ink"
      >
        {data.brands.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 pt-3 sm:px-6 lg:flex-nowrap lg:pt-0">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold tracking-tight lg:py-3">
            <Mark />
            BrandSentinel
          </Link>
          <div className="order-last w-full lg:order-none lg:w-auto">
            <Suspense fallback={<MainNav path={null} />}>
              <CurrentNav />
            </Suspense>
          </div>
          <div className="ml-auto lg:py-2.5">
            <RoleSwitcher />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 text-[13px] text-ink-soft sm:px-6">
        <BrandSwitcher />
        <p>Demo brands are fictional. No sign-in: switch roles at the top right to play the creator, the expert reviewer and the brand manager.</p>
      </div>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-5 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-[13px] text-ink-soft sm:px-6">
          <p>BrandSentinel prototype. AI checks use the Gemini API on fictional demo data, and every AI finding is checked against real rules and facts before it&apos;s shown.</p>
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
