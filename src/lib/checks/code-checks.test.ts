import { describe, expect, it } from "vitest";
import expected from "../../../demo/expected_findings.json";
import { demoBrand, demoFacts, demoRules, samplePosts } from "../demo/load-demo";
import { runCodeChecks } from "./code-checks";
import { runVisualChecks } from "./visual-checks";
import type { Finding } from "../types";

const rules = new Map(demoRules.map((r) => [r.id, r]));
const TODAY = "2026-11-08";

function check(id: string): Finding[] {
  const post = samplePosts(true).find((p) => p.id === id)!;
  return [...runCodeChecks({ input: post, rules, facts: demoFacts, brand: demoBrand, today: TODAY }), ...runVisualChecks(post, rules, demoBrand)];
}

type Expected = { rule: string; where: string; quote: string };
const locOf = (where: string) => (where === "image" ? "image 1" : where);

describe("fast checks against the demo answer key", () => {
  let caught = 0, total = 0, extra = 0, flagged = 0;
  for (const key of expected as { post: string; title: string; expected_findings: Expected[] }[]) {
    it(`${key.post}: ${key.title}`, () => {
      const found = check(key.post);
      const pool = [...found];
      const missed: Expected[] = [];
      for (const e of key.expected_findings) {
        const i = pool.findIndex((f) => f.rule_id === e.rule && f.location === locOf(e.where));
        if (i >= 0) pool.splice(i, 1);
        else missed.push(e);
      }
      total += key.expected_findings.length;
      caught += key.expected_findings.length - missed.length;
      flagged += found.length;
      extra += pool.length;
      if (missed.length || pool.length) {
        console.log(`${key.post} missed:`, missed.map((m) => `${m.rule} ${m.where} “${m.quote}”`));
        console.log(`${key.post} extra:`, pool.map((f) => `${f.rule_id} ${f.location} ${JSON.stringify(f.quotes)} ${f.message}`));
      }
      expect(missed).toEqual([]);
      expect(pool).toEqual([]);
    });
  }
  it("summary", () => {
    console.log(`caught ${caught}/${total}; ${extra} unexpected of ${flagged} flags`);
  });
});
