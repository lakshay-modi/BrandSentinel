// Governance insights: what goes wrong most, and which rules people keep disagreeing with.
import type { AskHuman, Category, Fact, Finding, Rule, Severity } from "./types";

export interface InsightInput {
  posts: { id: string; status: string; created_by: string }[];
  reviews: { post_id: string; score: number; findings: Finding[]; ask_human: AskHuman[]; created_at: string }[];
  decisions: { rule_id: string; action: "accept" | "edit" | "disagree"; reason: string | null; actor: string; created_at: string }[];
  rules: Rule[];
  facts: Fact[];
  today: string;
}

export interface Insights {
  totals: { posts: number; checks: number; approved: number; in_review: number; avg_first: number | null; avg_latest: number | null; acceptance: number | null };
  top_rules: { rule_id: string; rule: string; category: Category; severity: Severity; count: number; posts: number }[];
  by_category: { category: Category; count: number }[];
  unclear: { rule_id: string; rule: string; disagreements: number; people: number; reasons: string[]; status: "unclear" | "watch" }[];
  gaps: { quote: string; note: string }[];
  facts_expiring: { id: string; fact: string; valid_until: string; expired: boolean }[];
}

export const UNCLEAR_MIN_DISAGREEMENTS = 3;
export const UNCLEAR_MIN_PEOPLE = 2;

export function computeInsights(input: InsightInput): Insights {
  const ruleText = new Map(input.rules.map((r) => [r.id, r]));
  const byPost = new Map<string, InsightInput["reviews"]>();
  for (const r of [...input.reviews].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    byPost.set(r.post_id, [...(byPost.get(r.post_id) ?? []), r]);
  }
  const firsts = [...byPost.values()].map((rs) => rs[0]);
  const latests = [...byPost.values()].map((rs) => rs[rs.length - 1]);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  // problems on the first check show what creators get wrong before fixing
  const counts = new Map<string, { count: number; posts: Set<string> }>();
  const cats = new Map<Category, number>();
  for (const r of firsts)
    for (const f of r.findings) {
      const c = counts.get(f.rule_id) ?? { count: 0, posts: new Set<string>() };
      c.count++;
      c.posts.add(r.post_id);
      counts.set(f.rule_id, c);
      cats.set(f.category, (cats.get(f.category) ?? 0) + 1);
    }

  const decided = input.decisions.filter((d) => d.action !== "disagree").length;
  const disagreed = input.decisions.filter((d) => d.action === "disagree");

  const perRule = new Map<string, { n: number; people: Set<string>; reasons: string[] }>();
  for (const d of disagreed) {
    const x = perRule.get(d.rule_id) ?? { n: 0, people: new Set<string>(), reasons: [] };
    x.n++;
    x.people.add(d.actor.trim().toLowerCase());
    if (d.reason) x.reasons.push(d.reason);
    perRule.set(d.rule_id, x);
  }

  const gaps: Insights["gaps"] = [];
  for (const r of latests) for (const h of r.ask_human) if (gaps.length < 8 && !gaps.some((g) => g.note === h.note)) gaps.push({ quote: h.quote, note: tidy(h.note) });

  const soon = new Date(input.today + "T00:00:00Z");
  soon.setUTCDate(soon.getUTCDate() + 30);
  const soonIso = soon.toISOString().slice(0, 10);

  return {
    totals: {
      posts: input.posts.length,
      checks: input.reviews.length,
      approved: input.posts.filter((p) => p.status === "approved").length,
      in_review: input.posts.filter((p) => p.status === "in_review").length,
      avg_first: avg(firsts.map((r) => r.score)),
      avg_latest: avg(latests.map((r) => r.score)),
      acceptance: decided + disagreed.length ? Math.round((decided / (decided + disagreed.length)) * 100) : null,
    },
    top_rules: [...counts.entries()]
      .map(([rule_id, c]) => {
        const r = ruleText.get(rule_id);
        return { rule_id, rule: r?.rule ?? rule_id, category: r?.category ?? "words", severity: r?.severity ?? "low", count: c.count, posts: c.posts.size };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    by_category: [...cats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    unclear: [...perRule.entries()]
      .map(([rule_id, x]) => ({
        rule_id,
        rule: ruleText.get(rule_id)?.rule ?? rule_id,
        disagreements: x.n,
        people: x.people.size,
        reasons: x.reasons.slice(-3),
        status: (x.n >= UNCLEAR_MIN_DISAGREEMENTS && x.people.size >= UNCLEAR_MIN_PEOPLE ? "unclear" : "watch") as "unclear" | "watch",
      }))
      .sort((a, b) => b.disagreements - a.disagreements),
    gaps,
    facts_expiring: input.facts
      .filter((f) => f.valid_until <= soonIso)
      .map((f) => ({ id: f.id, fact: f.fact, valid_until: f.valid_until, expired: f.valid_until < input.today }))
      .sort((a, b) => a.valid_until.localeCompare(b.valid_until)),
  };
}

/** An older note may hold the AI thinking aloud: keep its first two sentences. */
function tidy(note: string): string {
  const parts = note.match(/[^.!?]+[.!?]+(\s|$)/g);
  const out = (parts ? parts.slice(0, 2).join("") : note).trim();
  return out.length > 260 ? `${out.slice(0, 259).trimEnd()}…` : out;
}
