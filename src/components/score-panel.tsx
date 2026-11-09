"use client";

import { SEVERITY_POINTS, type Finding } from "@/lib/types";
import { ScoreGauge } from "./score-gauge";

const BAND = {
  green: { label: "Ready for review", cls: "text-pass", bar: "bg-pass" },
  amber: { label: "Needs a few fixes", cls: "text-med", bar: "bg-med" },
  red: { label: "Not ready to publish", cls: "text-high", bar: "bg-high" },
};

const SEG: Record<Finding["severity"], string> = { high: "bg-high", medium: "bg-med", low: "bg-low" };

/** The score and a ledger bar: what is left, then one segment per problem showing the points it took. */
export function ScorePanel({ score, band, findings, onPick }: { score: number; band: "green" | "amber" | "red"; findings: Finding[]; onPick: (id: string) => void }) {
  const b = BAND[band];
  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach((f) => counts[f.severity]++);
  const parts = (["high", "medium", "low"] as const).filter((k) => counts[k]).map((k) => `${counts[k]} ${k}`);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ScoreGauge score={score} band={band} size={230} />
        <div className="min-w-[10rem] flex-1">
          <p className="text-[13px] font-medium text-ink-soft">Brand score</p>
          <p className={`mt-1 text-[22px] font-bold leading-tight tracking-tight ${b.cls}`}>{b.label}</p>
          <p className="text-[14px] text-ink-soft">{findings.length === 0 ? "No problems found" : `${parts.join(", ")} problem${findings.length > 1 ? "s" : ""}`}</p>
          <ul className="mt-3 space-y-1 text-[12px] text-ink-faint" aria-label="Score bands">
            <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#1f9d5a]" aria-hidden="true" />85 to 100: ready for review</li>
            <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#e8b210]" aria-hidden="true" />60 to 84: needs a few fixes</li>
            <li className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#d64532]" aria-hidden="true" />Below 60: not ready</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 flex h-4 gap-px overflow-hidden rounded-md bg-line" role="img" aria-label={`Score ${score} out of 100. Each problem's cost is shown as a segment.`}>
        <div className={`${b.bar} h-full`} style={{ width: `${score}%` }} />
        {findings.map((f, i) => (
          <button
            key={f.id}
            type="button"
            title={`Problem ${i + 1}: ${f.rule_id}, −${SEVERITY_POINTS[f.severity]} points`}
            aria-label={`Problem ${i + 1}: ${f.rule_id}, minus ${SEVERITY_POINTS[f.severity]} points`}
            onClick={() => onPick(f.id)}
            className={`${SEG[f.severity]} h-full opacity-35 transition-opacity hover:opacity-90 focus-visible:opacity-90`}
            style={{ width: `${SEVERITY_POINTS[f.severity]}%` }}
          />
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-faint">Starts at 100. A high problem costs 15 points, medium 7, low 3. Each faded segment is one problem: click it to jump there.</p>
    </div>
  );
}
