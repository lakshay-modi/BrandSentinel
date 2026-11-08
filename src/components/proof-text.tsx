"use client";

import type { Finding } from "@/lib/types";

interface Span {
  start: number;
  end: number;
  ref: number;
  severity: Finding["severity"];
  id: string;
}

/** Locates each finding's quotes in the text (exact first, then ignoring case) without overlaps. */
function spans(text: string, findings: { f: Finding; ref: number }[]): Span[] {
  const out: Span[] = [];
  const lower = text.toLowerCase();
  for (const { f, ref } of findings) {
    for (const q of f.quotes) {
      if (!q) continue;
      let i = text.indexOf(q);
      if (i < 0) i = lower.indexOf(q.toLowerCase());
      while (i >= 0 && out.some((s) => i < s.end && i + q.length > s.start)) {
        const next = lower.indexOf(q.toLowerCase(), i + 1);
        i = next;
      }
      if (i >= 0) out.push({ start: i, end: i + q.length, ref, severity: f.severity, id: f.id });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The caption as a marked-up proof: each problem underlined by severity, with its number from the findings list. */
export function ProofText({
  text,
  findings,
  onPick,
  activeId,
  onHover,
  className = "",
}: {
  text: string;
  findings: { f: Finding; ref: number }[];
  onPick?: (id: string) => void;
  /** the problem being pointed at elsewhere on the page: its mark is outlined */
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  className?: string;
}) {
  const marks = spans(text, findings);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach((m, i) => {
    if (m.start > pos) parts.push(text.slice(pos, m.start));
    parts.push(
      <mark
        key={i}
        className={`mark mark-${m.severity} text-inherit`}
        data-active={activeId === m.id}
        onClick={() => onPick?.(m.id)}
        onMouseEnter={() => onHover?.(m.id)}
        onMouseLeave={() => onHover?.(null)}
        title={`Problem ${m.ref}: click to open it`}
      >
        {text.slice(m.start, m.end)}
        <span className="mark-ref" aria-label={`problem ${m.ref}`}>
          {m.ref}
        </span>
      </mark>,
    );
    pos = m.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <p className={`whitespace-pre-wrap font-serif text-[22px] leading-[1.65] text-ink ${className}`}>{parts}</p>;
}
