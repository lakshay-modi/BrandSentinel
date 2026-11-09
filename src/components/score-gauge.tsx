"use client";

/**
 * The brand score on a simple half-circle meter: red below 60, yellow from 60 to 85, green from 85,
 * numbered every 10, with one needle and the score underneath.
 */
const CX = 100;
const CY = 100;
const R = 80;

// 0 on the left, 100 on the right, over the top
function point(v: number, r: number) {
  const a = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}
function arc(from: number, to: number, r: number) {
  const a = point(from, r);
  const b = point(to, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const ZONES = [
  { from: 0, to: 60, color: "#d64532" }, // red: not ready
  { from: 60, to: 85, color: "#e8b210" }, // yellow: needs fixes
  { from: 85, to: 100, color: "#1f9d5a" }, // green: ready
];
const BAND = {
  green: { text: "text-pass", label: "Ready" },
  amber: { text: "text-med", label: "Needs fixes" },
  red: { text: "text-high", label: "Not ready" },
} as const;

export function ScoreGauge({ score, band, size = 220, compact = false }: { score: number; band: "green" | "amber" | "red"; size?: number; compact?: boolean }) {
  const b = BAND[band];
  const s = Math.max(0, Math.min(100, score));
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  const zoneWidth = compact ? 16 : 9;
  return (
    <svg
      viewBox={compact ? "8 8 184 100" : "6 4 188 136"}
      width={size}
      height={compact ? (size * 100) / 184 : (size * 136) / 188}
      role="img"
      aria-label={`Brand score ${score} out of 100: ${b.label}`}
      className="block shrink-0 select-none"
    >
      {/* the three zones */}
      {ZONES.map((z) => (
        <path key={z.from} d={arc(z.from, z.to, R)} stroke={z.color} strokeWidth={zoneWidth} fill="none" />
      ))}

      {/* a mark every 5, a number every 10 */}
      {!compact &&
        ticks.map((t) => {
          const major = t % 10 === 0;
          const a = point(t, R - 6);
          const c = point(t, major ? R - 13 : R - 10);
          const l = point(t, R - 23);
          return (
            <g key={t}>
              <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke="var(--color-ink-soft)" strokeWidth={major ? 1.4 : 0.8} strokeLinecap="round" />
              {major && (
                <text x={l.x} y={l.y + 3} textAnchor="middle" fontSize={8} fill="var(--color-ink-soft)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t}
                </text>
              )}
            </g>
          );
        })}

      {/* needle, pointing at 0 and turned to the score */}
      <line
        x1={CX}
        y1={CY}
        x2={CX - (compact ? R - 4 : R - 18)}
        y2={CY}
        stroke="var(--color-ink)"
        strokeWidth={compact ? 4 : 2}
        strokeLinecap="round"
        className="gauge-needle"
        style={{ transform: `rotate(${s * 1.8}deg)`, transformOrigin: `${CX}px ${CY}px` }}
      />
      <circle cx={CX} cy={CY} r={compact ? 8 : 4.5} fill="var(--color-ink)" />

      {/* the score */}
      {!compact && (
        <text x={CX} y={CY + 30} textAnchor="middle" fontSize={26} fontWeight={700} className={b.text} fill="currentColor" style={{ fontVariantNumeric: "tabular-nums" }}>
          {score}
          <tspan fontSize={12} fontWeight={500} fill="var(--color-ink-faint)">
            {" "}
            / 100
          </tspan>
        </text>
      )}
    </svg>
  );
}
