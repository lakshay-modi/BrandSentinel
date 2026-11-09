"use client";

import { useId } from "react";

/**
 * The brand score as a car-style dial: 0 to 100 over a 240° sweep, red below 60, amber to 85, green above.
 * The needle swings in from 0 when the dial first appears and glides to a new score after a re-check.
 */
const SWEEP = 240;
const START = -SWEEP / 2;
const CX = 120;
const CY = 120;

const angle = (v: number) => START + (SWEEP * Math.max(0, Math.min(100, v))) / 100;
function point(v: number, r: number) {
  const a = (angle(v) * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}
function arc(from: number, to: number, r: number) {
  const a = point(from, r);
  const b = point(to, r);
  const large = ((to - from) * SWEEP) / 100 > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const BAND_HEX = { red: "#ef5b3f", amber: "#f2a516", green: "#2fbf71" } as const;
const ZONES = [
  { from: 0, to: 60, color: BAND_HEX.red },
  { from: 60, to: 85, color: BAND_HEX.amber },
  { from: 85, to: 100, color: BAND_HEX.green },
];

export function ScoreGauge({ score, band, size = 240, compact = false }: { score: number; band: "green" | "amber" | "red"; size?: number; compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  const color = BAND_HEX[band];
  const label = band === "green" ? "Ready" : band === "amber" ? "Needs fixes" : "Not ready";
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      role="img"
      aria-label={`Brand score ${score} out of 100: ${label}`}
      className="block shrink-0 select-none"
    >
      <defs>
        <radialGradient id={`face-${id}`} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#2a3550" />
          <stop offset="70%" stopColor="#141b2d" />
          <stop offset="100%" stopColor="#0b101c" />
        </radialGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c3cad4" />
          <stop offset="50%" stopColor="#7d8696" />
          <stop offset="100%" stopColor="#dde2e8" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* bezel and face */}
      <circle cx={CX} cy={CY} r={116} fill={`url(#rim-${id})`} />
      <circle cx={CX} cy={CY} r={110} fill={`url(#face-${id})`} />

      {/* coloured zones on the outer ring */}
      {ZONES.map((z) => (
        <path key={z.from} d={arc(z.from, z.to, 98)} stroke={z.color} strokeWidth={5} fill="none" opacity={0.95} />
      ))}

      {/* progress up to the score, lit in the band colour */}
      <path d={arc(0, 100, 84)} stroke="#ffffff" strokeOpacity={0.08} strokeWidth={8} fill="none" strokeLinecap="round" />
      <path
        d={arc(0, 100, 84)}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${Math.max(0.01, score)} 100`}
        filter={`url(#glow-${id})`}
        className="gauge-progress"
        style={{ ["--gauge-to" as string]: score }}
      />

      {/* ticks and numbers */}
      {ticks.map((t) => {
        const major = t % 10 === 0;
        const a = point(t, 94);
        const b = point(t, major ? 86 : 90);
        return <line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={major ? 0.85 : 0.35} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
      })}
      {!compact &&
        [0, 20, 40, 60, 80, 100].map((t) => {
          const p = point(t, 70);
          return (
            <text key={t} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#ffffff" fillOpacity={0.6} style={{ fontVariantNumeric: "tabular-nums" }}>
              {t}
            </text>
          );
        })}

      {/* needle */}
      <g className="gauge-needle" style={{ transform: `rotate(${angle(score)}deg)`, transformOrigin: `${CX}px ${CY}px`, ["--needle-from" as string]: `${START}deg` }}>
        <path d={`M ${CX - 4} ${CY + 14} L ${CX - 1.4} ${CY - 92} L ${CX + 1.4} ${CY - 92} L ${CX + 4} ${CY + 14} Z`} fill={color} filter={`url(#glow-${id})`} />
      </g>
      <circle cx={CX} cy={CY} r={11} fill="#0b101c" stroke="#c3cad4" strokeWidth={2} />
      <circle cx={CX} cy={CY} r={3.5} fill={color} />

      {/* digital readout */}
      <text x={CX} y={CY + 50} textAnchor="middle" fontSize={compact ? 40 : 36} fontWeight={800} fill="#ffffff" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
        {score}
      </text>
      {!compact && (
        <text x={CX} y={CY + 68} textAnchor="middle" fontSize={10} fontWeight={700} fill={color} style={{ letterSpacing: "0.14em" }}>
          {label.toUpperCase()}
        </text>
      )}
      <text x={CX} y={CY - 34} textAnchor="middle" fontSize={9} fontWeight={700} fill="#ffffff" fillOpacity={0.45} style={{ letterSpacing: "0.18em" }}>
        BRAND SCORE
      </text>
    </svg>
  );
}
