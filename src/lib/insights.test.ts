import { describe, expect, it } from "vitest";
import { computeInsights } from "./insights";
import { demoFacts, demoRules } from "./demo/load-demo";
import type { Finding } from "./types";

const f = (rule_id: string, severity: Finding["severity"] = "low"): Finding => ({
  id: rule_id, rule_id, category: "tone", severity, location: "caption", quotes: [], message: "", evidence: "", fact_ids: [], fix: { kind: "manual", advice: "" }, source: "code",
});
const d = (rule_id: string, actor: string, action: "accept" | "disagree" = "disagree") => ({ rule_id, action, reason: action === "disagree" ? "launch posts can be exciting" : null, actor, created_at: "2026-11-08T10:00:00Z" });

describe("insights", () => {
  const base = {
    posts: [{ id: "a", status: "approved", created_by: "Priya" }, { id: "b", status: "in_review", created_by: "Rahul" }],
    reviews: [
      { post_id: "a", score: 60, findings: [f("TONE-01", "medium"), f("WORD-03")], ask_human: [], created_at: "2026-11-08T09:00:00Z" },
      { post_id: "a", score: 100, findings: [], ask_human: [], created_at: "2026-11-08T09:05:00Z" },
      { post_id: "b", score: 80, findings: [f("TONE-01", "medium")], ask_human: [], created_at: "2026-11-08T09:10:00Z" },
    ],
    rules: demoRules,
    facts: demoFacts,
    today: "2026-11-08",
  };

  it("counts problems from each post's first check and shows the score improving", () => {
    const i = computeInsights({ ...base, decisions: [] });
    expect(i.top_rules[0]).toMatchObject({ rule_id: "TONE-01", count: 2, posts: 2 });
    expect(i.totals.avg_first).toBe(70);
    expect(i.totals.avg_latest).toBe(90);
  });

  it("flags a rule as unclear after 3 disagreements from 2 people", () => {
    const watch = computeInsights({ ...base, decisions: [d("TONE-01", "Priya"), d("TONE-01", "Priya"), d("TONE-01", "Priya")] });
    expect(watch.unclear[0].status).toBe("watch");
    const unclear = computeInsights({ ...base, decisions: [d("TONE-01", "Priya"), d("TONE-01", "Rahul"), d("TONE-01", "Priya"), d("WORD-03", "Priya", "accept")] });
    expect(unclear.unclear[0]).toMatchObject({ rule_id: "TONE-01", disagreements: 3, people: 2, status: "unclear" });
    expect(unclear.totals.acceptance).toBe(25);
  });

  it("lists facts that expired or expire within 30 days", () => {
    const i = computeInsights({ ...base, decisions: [] });
    expect(i.facts_expiring.find((x) => x.id === "F-14")?.expired).toBe(true);
    expect(i.facts_expiring.find((x) => x.id === "F-13")?.expired).toBe(false);
  });
});
