"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Severity } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-sm hover:bg-[#26304a] disabled:bg-ink-faint",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-faint hover:bg-paper disabled:text-ink-faint",
  ghost: "text-ink-soft hover:bg-paper hover:text-ink disabled:text-ink-faint",
  danger: "border border-high/40 bg-surface text-high hover:bg-high-bg disabled:opacity-50",
  dangerSolid: "bg-high text-white shadow-sm hover:bg-[#9c2a1f] disabled:opacity-50",
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

/** A grey placeholder block shown while data loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-line/70 motion-reduce:animate-none ${className}`} />;
}

/** Placeholder for a whole page while its data loads. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-[28rem] max-w-full" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

/** A modal dialog (native <dialog>: focus trap, Esc to close, and the page behind can't be clicked). */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`dialog-in m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] ${wide ? "max-w-2xl" : "max-w-md"}`}
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[18px] font-bold tracking-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Ask before something that can't be undone. `confirmText`, when given, must be typed to enable the button. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  action,
  confirmText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  children: ReactNode;
  action: string;
  confirmText?: string;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = !confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase();
  return (
    <Dialog
      open={open}
      onClose={() => {
        setTyped("");
        onClose();
      }}
      title={title}
    >
      <div className="space-y-4 text-[14px] leading-relaxed text-ink-soft">
        {children}
        {confirmText && (
          <label className="block text-[13px]">
            Type <span className="font-semibold text-ink">{confirmText}</span> to confirm
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className="field mt-1" />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="dangerSolid"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setTyped("");
              }
            }}
          >
            {action}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Shown when a list has nothing in it yet: what this place is for and the next thing to do. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-[14px] text-ink-soft">{children}</p>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

/** A small count pill, for tabs and nav items. */
export function Count({ n, tone = "neutral" }: { n: number; tone?: "neutral" | "alert" }) {
  return (
    <span
      className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-[18px] ${tone === "alert" ? "bg-high text-white" : "bg-line text-ink-soft"}`}
    >
      {n}
    </span>
  );
}
