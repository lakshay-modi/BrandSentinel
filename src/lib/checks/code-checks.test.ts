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

describe("confidential names (WORD-08)", () => {
  it("flags a confidential term from the brand settings, in any letter case", () => {
    const post = { ...samplePosts(true).find((p) => p.id === "P08")!, caption: "A sneak peek of project harvest, coming soon. #OatviaEveryday", images: [] };
    const found = runCodeChecks({ input: post, rules, facts: demoFacts, brand: demoBrand, today: TODAY }).filter((f) => f.rule_id === "WORD-08");
    expect(found).toHaveLength(1);
    expect(found[0].quotes).toEqual(["project harvest"]);
    expect(found[0].severity).toBe("high");
  });
});

describe("imported rules never trigger fast image checks", () => {
  it("ignores READ-01, READ-02 and VIS-01 when they are AI-checked rules about something else", () => {
    const aiOnly = new Map([...rules].map(([k, v]) => [k, { ...v, check_type: "ai" as const }]));
    const p09 = samplePosts(true).find((p) => p.id === "P09")!; // off-brand colours, low contrast, no alt text
    expect(runVisualChecks(p09, rules, demoBrand).length).toBeGreaterThan(0);
    expect(runVisualChecks(p09, aiOnly, demoBrand)).toEqual([]);
  });
});
