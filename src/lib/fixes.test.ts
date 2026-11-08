import { describe, expect, it } from "vitest";
import { applyFix } from "./fixes";

describe("applying fixes", () => {
  it("replaces text", () => {
    expect(applyFix("Our new chocolate flavor is a favorite", { kind: "replace", pairs: [{ from: "flavor", to: "flavour" }, { from: "favorite", to: "favourite" }] })).toBe(
      "Our new chocolate flavour is a favourite",
    );
  });
  it("removes text and tidies punctuation", () => {
    expect(applyFix("Meet ProBar: 20 g protein, vegan and tasty.", { kind: "remove", quotes: ["vegan and "] })).toBe("Meet ProBar: 20 g protein, tasty.");
    expect(applyFix("Light, eco-friendly, tasty", { kind: "remove", quotes: ["eco-friendly"] })).toBe("Light, tasty");
  });
  it("adds required text before trailing hashtags", () => {
    expect(applyFix("20% off with code OATVIA20 #OatviaEveryday #Snacks", { kind: "add_end", text: " T&C apply." })).toBe(
      "20% off with code OATVIA20. T&C apply. #OatviaEveryday #Snacks",
    );
  });
  it("adds a disclosure at the start once", () => {
    expect(applyFix("My snack", { kind: "add_start", text: "#ad " })).toBe("#ad My snack");
    expect(applyFix("#ad My snack", { kind: "add_start", text: "#ad " })).toBe("#ad My snack");
  });
  it("returns null when the text has already changed", () => {
    expect(applyFix("hello", { kind: "replace", pairs: [{ from: "bye", to: "x" }] })).toBeNull();
  });
});

describe("exclamation mark fix (TONE-02)", () => {
  it("keeps the allowed number, one at a time, and turns the rest into full stops", async () => {
    const { runCodeChecks } = await import("./checks/code-checks");
    const { demoBrand, demoFacts, demoRules, samplePosts } = await import("./demo/load-demo");
    const rules = new Map(demoRules.map((r) => [r.id, r]));
    const p01 = samplePosts(true).find((p) => p.id === "P01")!;
    const f = runCodeChecks({ input: p01, rules, facts: demoFacts, brand: demoBrand, today: "2026-11-08" }).find((x) => x.rule_id === "TONE-02")!;
    expect(applyFix(p01.caption, f.fix)).toBe("India's No. 1 protein bar! 100% natural, eco-friendly pack. Grab yours NOW! #protein #OatviaEveryday");
    const p = { ...p01, post_type: "product", caption: "So good! Try it! Now!" };
    const g = runCodeChecks({ input: p, rules, facts: demoFacts, brand: demoBrand, today: "2026-11-08" }).find((x) => x.rule_id === "TONE-02")!;
    expect(applyFix(p.caption, g.fix)).toBe("So good! Try it. Now.");
  });
});
