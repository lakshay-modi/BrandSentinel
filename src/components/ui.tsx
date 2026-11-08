"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Severity } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#25314a] disabled:bg-ink-faint",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-paper disabled:text-ink-faint",
  ghost: "text-ink-soft hover:bg-paper hover:text-ink disabled:text-ink-faint",
  danger: "border border-high/40 bg-surface text-high hover:bg-high-bg disabled:opacity-50",
  success: "bg-pass text-white hover:bg-[#126640] disabled:opacity-50",
};

export function Button({ variant = "secondary", size = "md", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium disabled:cursor-not-allowed ${sz} ${VARIANT[variant]} ${className}`} />;
}

export const SEVERITY_STYLE: Record<Severity, { label: string; text: string; bg: string; dot: string }> = {
  high: { label: "High", text: "text-high", bg: "bg-high-bg", dot: "bg-high" },
  medium: { label: "Medium", text: "text-med", bg: "bg-med-bg", dot: "bg-med" },
  low: { label: "Low", text: "text-low", bg: "bg-low-bg", dot: "bg-low" },
};

export function SeverityTag({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLE[severity];
  return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
}

export function Panel({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-paper text-ink-soft border border-line" },
  in_review: { label: "In review", cls: "bg-low-bg text-low" },
  changes_requested: { label: "Changes requested", cls: "bg-med-bg text-med" },
  approved: { label: "Approved", cls: "bg-pass-bg text-pass" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-high/30 bg-high-bg px-3 py-2 text-sm text-high">
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
