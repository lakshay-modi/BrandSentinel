import { SEVERITY_POINTS, type Finding } from "../types";

/** Brand score: start at 100, minus 15 / 7 / 3 for each high / medium / low finding. */
export function brandScore(findings: Pick<Finding, "severity">[]): { score: number; band: "green" | "amber" | "red" } {
  const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + SEVERITY_POINTS[f.severity], 0));
  return { score, band: score >= 85 ? "green" : score >= 60 ? "amber" : "red" };
}

/** Gives each finding a stable id like "WORD-03:caption:1" (same post text gives the same ids). */
export function assignIds(findings: Finding[]): Finding[] {
  const counts = new Map<string, number>();
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return findings
    .map((f) => {
      if (f.id) return f;
      const key = `${f.rule_id}:${f.location.replace(" ", "")}`;
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { ...f, id: `${key}:${n}` };
    })
    .sort((a, b) => order[a.severity] - order[b.severity] || (a.location === "caption" ? -1 : 1) - (b.location === "caption" ? -1 : 1));
}

/** Needs an expert reviewer if any unresolved problem is a claim or high severity, or the creator disputed one. */
export function needsExpert(findings: Finding[], resolvedIds: Set<string>, disputed: boolean): boolean {
  if (disputed) return true;
  return findings.some((f) => !resolvedIds.has(f.id) && (f.category === "claims" || f.severity === "high"));
}
