"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Severity } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-sm hover:bg-[#26304a] disabled:bg-ink-faint",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-faint hover:bg-paper disabled:text-ink-faint",
  ghost: "text-ink-soft hover:bg-paper hover:text-ink disabled:text-ink-faint",
  danger: "border border-high/40 bg-surface text-high hover:bg-high-bg disabled:opacity-50",
  success: "bg-pass text-white shadow-sm hover:bg-[#156540] disabled:opacity-50",
};

export function Button({ variant = "secondary", size = "md", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]";
  return <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${sz} ${VARIANT[variant]} ${className}`} />;
}

export const SEVERITY_STYLE: Record<Severity, { label: string; text: string; bg: string; dot: string }> = {
  high: { label: "High", text: "text-high", bg: "bg-high-bg", dot: "bg-high" },
  medium: { label: "Medium", text: "text-med", bg: "bg-med-bg", dot: "bg-med" },
  low: { label: "Low", text: "text-low", bg: "bg-low-bg", dot: "bg-low" },
};

export function SeverityTag({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLE[severity];
  return <span className={`inline-flex items-center rounded-md px-1.5 py-px text-[12px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
}

export function Panel({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      <div className={title || action ? "px-5 pb-5 pt-3" : "p-5"}>{children}</div>
    </section>
  );
}

export const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-surface text-ink-soft border border-line-strong" },
  in_review: { label: "In review", cls: "bg-low-bg text-low" },
  changes_requested: { label: "Changes requested", cls: "bg-med-bg text-med" },
  approved: { label: "Approved", cls: "bg-pass-bg text-pass" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${s.cls}`}>{s.label}</span>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-high/30 bg-high-bg px-3 py-2 text-sm text-high">
      {children}
    </p>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const CHANNEL_LABEL: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", x: "X", website: "Website", email: "Email" };

/** A rule or fact ID, shown in mono and linked to its entry. */
export function IdLink({ kind, id, className = "" }: { kind: "rule" | "fact"; id: string; className?: string }) {
  return (
    <a
      href={kind === "rule" ? `/rulebook#${id}` : `/facts#${id}`}
      title={kind === "rule" ? "Open this rule in the Rulebook" : "Open this fact in the Fact Bank"}
      className={`font-mono text-[12.5px] font-medium text-ink underline decoration-line-strong underline-offset-[3px] hover:decoration-ink ${className}`}
    >
      {id}
    </a>
  );
}
