import { describe, expect, it } from "vitest";
import { runCodeChecks } from "./checks/code-checks";
import { runVisualChecks } from "./checks/visual-checks";
import { STARTER_RULES } from "./starter-rules";
import type { BrandSettings, PostInput, Rule } from "./types";

// a brand that is not the demo brand: the starter rules must work for anyone
const brand: BrandSettings = {
  name: "Kiro Bikes",
  palette: [],
  palette_tolerance: 40,
  products: ["Kiro One", "Kiro Cargo"],
  product_misspellings: ["Kiroone", "kiro cargo"],
  brand_hashtag: "#RideKiro",
  confidential_terms: ["Project Falcon"],
};
const rules = new Map(STARTER_RULES.map((r) => [r.id, { ...r, status: "approved", version: 1 } as Rule]));
const post = (p: Partial<PostInput>): PostInput => ({ channel: "instagram", post_type: "product", product: "Kiro One", partner: false, caption: "", images: [], ...p });
const run = (input: PostInput) => [...runCodeChecks({ input, rules, facts: [], brand, today: "2026-11-14" }), ...runVisualChecks(input, rules, brand)];
const ids = (input: PostInput) => run(input).map((f) => f.rule_id).sort();

describe("starter rules for a brand new workspace", () => {
  it("every starter rule has an example, a reason and a unique ID", () => {
    expect(new Set(STARTER_RULES.map((r) => r.id)).size).toBe(STARTER_RULES.length);
    for (const r of STARTER_RULES) {
      expect(r.rule.length).toBeGreaterThan(10);
      expect(r.guideline.length).toBeGreaterThan(10);
      expect(r.good && r.bad).toBeTruthy();
    }
  });

  it("a clean post gets no problems", () => {
    expect(ids(post({ caption: "The Kiro One is back in stock this week. #RideKiro" }))).toEqual([]);
  });

  it("catches a ranking, capitals, pressure, too many exclamation marks and a missing brand hashtag", () => {
    const found = ids(post({ caption: "India's No. 1 e-bike is HERE!!! Hurry, last chance to book." }));
    expect(found).toEqual(expect.arrayContaining(["CLAIM-01", "TONE-01", "TONE-02", "TONE-03", "WORD-06"]));
  });

  it("asks a paid partner post to start with a disclosure", () => {
    expect(ids(post({ partner: true, caption: "Loving my new ride. #RideKiro" }))).toContain("CLAIM-08");
    expect(ids(post({ partner: true, caption: "#ad Loving my new ride. #RideKiro" }))).not.toContain("CLAIM-08");
  });

  it("corrects a listed misspelling to the closest approved name of this brand, not the demo brand's", () => {
    const f = run(post({ caption: "The Kiroone is here. #RideKiro" })).find((x) => x.rule_id === "WORD-01");
    expect(f?.fix).toEqual({ kind: "replace", pairs: [{ from: "Kiroone", to: "Kiro One" }] });
  });

  it("flags confidential names, too many hashtags and an image without alt text", () => {
    const found = ids(post({ caption: "Project Falcon ships soon. #RideKiro #a #b #c #d #e", images: [{ src: "/demo/x.png", alt_text: "" }] }));
    expect(found).toEqual(expect.arrayContaining(["WORD-08", "WORD-07", "READ-02"]));
  });
});
