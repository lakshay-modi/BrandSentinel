import { describe, expect, it } from "vitest";
import { proofCheck } from "./proof";
import { aiResponseSchema } from "./prompt";
import { demoBrand, demoFacts, demoRules, samplePosts } from "../demo/load-demo";
import { runCodeChecks } from "../checks/code-checks";
import { assignIds } from "../review/score";

const rules = new Map(demoRules.map((r) => [r.id, r]));
const post = { ...samplePosts(true).find((p) => p.id === "P08")!, caption: "Our bar keeps your heart happy and is way tastier than other snacks. #OatviaEveryday" };
const code = assignIds(runCodeChecks({ input: post, rules, facts: demoFacts, brand: demoBrand, today: "2026-11-08" }));

const ai = (findings: object[], extra: object = {}) => aiResponseSchema.parse({ findings, ...extra });

describe("proof check", () => {
  it("keeps an AI finding whose rule and quote are real", () => {
    const r = proofCheck(ai([{ rule_id: "CLAIM-04", location: "caption", quote: "keeps your heart happy", message: "Implied heart-health claim", fix: "" }]), code, post, rules, demoFacts);
    const f = r.findings.find((x) => x.source === "ai")!;
    expect(f.rule_id).toBe("CLAIM-04");
    expect(f.severity).toBe("high"); // from the rule, not the AI
    expect(f.fix).toEqual({ kind: "remove", quotes: ["keeps your heart happy"] });
  });

  it("drops a finding whose quote is not in the post (hallucination)", () => {
    const r = proofCheck(ai([{ rule_id: "CLAIM-04", quote: "cures diabetes", message: "x" }]), code, post, rules, demoFacts);
    expect(r.findings.filter((x) => x.source === "ai")).toHaveLength(0);
    expect(r.dropped).toBe(1);
  });

  it("sends a finding under an unknown rule to a human instead", () => {
    const r = proofCheck(ai([{ rule_id: "MADE-UP-1", quote: "tastier", message: "x" }]), code, post, rules, demoFacts);
    expect(r.findings.filter((x) => x.source === "ai")).toHaveLength(0);
    expect(r.ask_human).toHaveLength(1);
  });

  it("sends a finding that cites a fact that doesn't exist to a human", () => {
    const r = proofCheck(ai([{ rule_id: "CLAIM-02", quote: "tastier", fact_ids: ["F-99"], message: "x" }]), code, post, rules, demoFacts);
    expect(r.findings.filter((x) => x.source === "ai")).toHaveLength(0);
    expect(r.ask_human[0].note).toContain("F-99");
  });

  it("merges an AI finding that repeats a code finding instead of double counting", () => {
    const comparison = code.find((f) => f.rule_id === "CLAIM-07")!;
    expect(comparison).toBeDefined();
    const r = proofCheck(ai([{ rule_id: "CLAIM-07", quote: "tastier than other snacks", message: "comparison", fix: "really tasty" }]), code, post, rules, demoFacts);
    const all = r.findings.filter((x) => x.rule_id === "CLAIM-07");
    expect(all).toHaveLength(1);
    expect(all[0].source).toBe("code+ai");
  });

  it("ignores AI findings under code-only rules", () => {
    const r = proofCheck(ai([{ rule_id: "WORD-04", quote: "tastier", message: "x" }]), code, post, rules, demoFacts);
    expect(r.findings.filter((x) => x.source === "ai")).toHaveLength(0);
  });

  it("treats an AI finding under a code-only rule that the fast checks already found as agreement", () => {
    const p4 = samplePosts(true).find((p) => p.id === "P04")!;
    const c4 = assignIds(runCodeChecks({ input: p4, rules, facts: demoFacts, brand: demoBrand, today: "2026-11-08" }));
    const tags = c4.find((f) => f.rule_id === "READ-03")!;
    expect(tags).toBeDefined();
    const r = proofCheck(ai([{ rule_id: "READ-03", quote: "#fitnessmotivation", message: "Use CamelCase" }]), c4, p4, rules, demoFacts);
    expect(r.ask_human).toHaveLength(0);
    expect(r.dropped).toBe(0);
    expect(r.findings.find((x) => x.rule_id === "READ-03")?.source).toBe("code+ai");
  });

  it("matches quotes even when the AI changes letter case", () => {
    const r = proofCheck(ai([{ rule_id: "CLAIM-04", quote: "KEEPS YOUR HEART HAPPY", message: "x", fix: null, fix_advice: "Remove it" }]), code, post, rules, demoFacts);
    expect(r.findings.find((x) => x.source === "ai")?.quotes).toEqual(["keeps your heart happy"]);
  });
});
