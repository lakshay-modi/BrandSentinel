"use client";

import { SEVERITY_POINTS, type Finding } from "@/lib/types";

const BAND = {
  green: { label: "Ready for review", cls: "text-pass", bar: "bg-pass" },
  amber: { label: "Needs a few fixes", cls: "text-med", bar: "bg-med" },
  red: { label: "Not ready to publish", cls: "text-high", bar: "bg-high" },
};

const SEG: Record<Finding["severity"], string> = { high: "bg-high", medium: "bg-med", low: "bg-low" };

/** Score plus a bar showing exactly which problems took points away. */
export function ScorePanel({ score, band, findings, onPick }: { score: number; band: "green" | "amber" | "red"; findings: Finding[]; onPick: (id: string) => void }) {
  const b = BAND[band];
  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach((f) => counts[f.severity]++);
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Brand score</p>
          <p className="text-4xl font-semibold tabular-nums">
            {score}
            <span className="text-lg text-ink-faint">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`font-semibold ${b.cls}`}>{b.label}</p>
          <p className="text-sm text-ink-soft">
            {findings.length === 0 ? "No problems found" : `${counts.high} high, ${counts.medium} medium, ${counts.low} low`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-pass-bg" role="img" aria-label={`Score ${score} out of 100`}>
        <div className={`${b.bar} h-full`} style={{ width: `${score}%` }} />
        {findings.map((f, i) => (
          <button
            key={f.id}
            type="button"
            title={`Problem ${i + 1}: ${f.rule_id}, −${SEVERITY_POINTS[f.severity]}`}
            onClick={() => onPick(f.id)}
            className={`${SEG[f.severity]} h-full border-l border-white opacity-40 hover:opacity-80`}
            style={{ width: `${SEVERITY_POINTS[f.severity]}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-faint">Starts at 100. Each high problem costs 15 points, medium 7, low 3. The faded part of the bar shows what each problem cost.</p>
    </div>
  );
}
