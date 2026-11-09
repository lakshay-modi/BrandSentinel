"use client";

/**
 * The brand score as a simple dial: a half circle from 0 to 100, filled up to the score in its band colour,
 * with a thin needle. Marks at 60 and 85 show where the bands change.
 */
const CX = 100;
const CY = 100;
const R = 80;

// 0 sits on the left, 100 on the right, over the top
function point(v: number, r: number) {
  const a = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}
function arc(from: number, to: number, r: number) {
  const a = point(from, r);
  const b = point(to, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const BAND = {
  green: { stroke: "var(--color-pass)", text: "text-pass", label: "Ready" },
  amber: { stroke: "var(--color-med)", text: "text-med", label: "Needs fixes" },
  red: { stroke: "var(--color-high)", text: "text-high", label: "Not ready" },
} as const;

export function ScoreGauge({ score, band, size = 200, compact = false }: { score: number; band: "green" | "amber" | "red"; size?: number; compact?: boolean }) {
  const b = BAND[band];
  const s = Math.max(0, Math.min(100, score));
  return (
    <svg viewBox={compact ? "8 8 184 104" : "-6 -10 212 152"} width={size} height={compact ? (size * 104) / 184 : (size * 152) / 212} role="img" aria-label={`Brand score ${score} out of 100: ${b.label}`} className="block shrink-0 select-none overflow-visible">
      {/* track, and the score filled in its band colour */}
      <path d={arc(0, 100, R)} stroke="var(--color-line)" strokeWidth={compact ? 14 : 10} fill="none" strokeLinecap="round" />
      <path
        d={arc(0, 100, R)}
        stroke={b.stroke}
        strokeWidth={compact ? 14 : 10}
        fill="none"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${Math.max(0.01, s)} 100`}
        className="gauge-progress"
      />

      {/* where the bands change: 60 and 85 outside the arc, 0 and 100 under its ends */}
      {!compact &&
        [0, 60, 85, 100].map((t) => {
          const end = t === 0 || t === 100;
          const a = point(t, R + 7);
          const c = point(t, R + 11);
          const l = end ? { x: point(t, R).x, y: CY + 20 } : point(t, R + 20);
          return (
            <g key={t}>
              {!end && <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke="var(--color-ink-faint)" strokeWidth={1.25} strokeLinecap="round" />}
              <text x={l.x} y={l.y + 3.5} textAnchor="middle" fontSize={10} fill="var(--color-ink-faint)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {t}
              </text>
            </g>
          );
        })}

      {/* needle */}
      {!compact && (
        <>
          <line
            x1={CX}
            y1={CY}
            x2={CX - (R - 16)}
            y2={CY}
            stroke="var(--color-ink)"
            strokeWidth={2}
            strokeLinecap="round"
            className="gauge-needle"
            style={{ transform: `rotate(${s * 1.8}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          />
          <circle cx={CX} cy={CY} r={4.5} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth={2} />
        </>
      )}

      {/* the number */}
      <text
        x={CX}
        y={compact ? CY - 4 : CY + 34}
        textAnchor="middle"
        fontSize={compact ? 40 : 30}
        fontWeight={700}
        className={b.text}
        fill="currentColor"
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
      >
        {score}
      </text>
    </svg>
  );
}
