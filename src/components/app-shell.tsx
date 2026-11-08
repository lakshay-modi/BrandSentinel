"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL, useRole } from "./role-provider";

const NAV = [
  { href: "/", label: "Check a post" },
  { href: "/queue", label: "Review queue" },
  { href: "/rulebook", label: "Rulebook" },
  { href: "/facts", label: "Fact Bank" },
  { href: "/insights", label: "Insights" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { role, setRole, name, setName } = useRole();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Z" fill="var(--color-ink)" />
              <path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            BrandSentinel
          </Link>
          <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto">
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 ${active ? "bg-ink text-white" : "text-ink-soft hover:bg-paper hover:text-ink"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <label htmlFor="role" className="text-ink-faint">
              Acting as
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              title={ROLE_HINT[role]}
              className="rounded-md border border-line-strong bg-surface px-2 py-1.5 font-medium"
            >
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <input
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-24 rounded-md border border-line-strong bg-surface px-2 py-1.5"
            />
          </div>
        </div>
        <div className="border-t border-line bg-paper">
          <p className="mx-auto max-w-7xl px-4 py-1.5 text-xs text-ink-soft sm:px-6">
            Demo brand: <strong>Oatvia Foods</strong> (fictional). No sign-in needed. Switch roles at the top right to play creator, brand manager and expert reviewer.
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink-faint">
        BrandSentinel prototype. AI checks use the Gemini API free tier, on fictional demo data only. Every AI finding is checked against real rules and facts before it's shown.
      </footer>
    </div>
  );
}
