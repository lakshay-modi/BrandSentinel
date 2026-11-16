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

  it("catches health claims and numbers with no approved fact (the gap a real Slack test found)", () => {
    const found = run(post({ caption: "Meet the Kiro One: clinically proven to boost your energy, 20 km range and only ₹45,000. #RideKiro" }));
    const claims = found.filter((f) => f.rule_id === "CLAIM-04").flatMap((f) => f.quotes);
    expect(claims.join(" ")).toMatch(/clinically proven/i);
    expect(claims.join(" ")).toMatch(/boost your energy/i);
    expect(found.filter((f) => f.rule_id === "CLAIM-02").length).toBeGreaterThan(0);
  });

  it("compares spec numbers like km with the Fact Bank", () => {
    const facts = [{ id: "F-01", product: "Kiro One", fact: "Kiro One has a 60 km range on one charge.", source: "Spec sheet", valid_until: "2027-12-31", type: "general" }];
    const check = (caption: string) => runCodeChecks({ input: post({ caption }), rules, facts, brand, today: "2026-11-14" }).filter((f) => f.rule_id === "CLAIM-02");
    const wrong = check("The Kiro One goes 80 km on one charge. #RideKiro");
    expect(wrong[0]?.message).toMatch(/80 km.*F-01/);
    expect(check("The Kiro One goes 60 km on one charge. #RideKiro")).toEqual([]);
    expect(check("Charges in 4 hours, weighs 18 kg. #RideKiro").flatMap((f) => f.quotes)).toEqual(expect.arrayContaining(["4 hours", "18 kg"]));
  });

  it("sees through hidden characters and look-alike digits, and quotes the original text", () => {
    const found = run(post({ caption: "Clin\u200bically pr0ven to cure stress. India's N0. 1 e-bike, the b3st. #RideKiro" }));
    const quotes = (id: string) => found.filter((f) => f.rule_id === id).flatMap((f) => f.quotes);
    expect(quotes("CLAIM-04")).toEqual(expect.arrayContaining(["Clin\u200bically pr0ven", "cure"]));
    expect(quotes("CLAIM-01").join(" ")).toMatch(/N0\. 1/);
    // look-alike reading doesn't touch codes and numbers
    expect(ids(post({ caption: "Use code KIRO10 at any store. #RideKiro" }))).toEqual([]);
  });

  it("catches common superlatives", () => {
    expect(ids(post({ caption: "The safest and fastest e-bike around. #RideKiro" }))).toContain("CLAIM-01");
  });

  it("checks word lists imported from a brand's guidelines in plain code (Mailchimp-style rules)", () => {
    const withLists = new Map(rules);
    withLists.set("WORD-17", { id: "WORD-17", category: "words", severity: "medium", check_type: "code+ai", scope: "all", rule: "Never use the banned words.", guideline: "", good: "", bad: "", status: "approved", version: 1, params: { banned_phrases: ["leverage", "automagical", "crushing it"] } } as unknown as Rule);
    withLists.set("WORD-11", { id: "WORD-11", category: "words", severity: "low", check_type: "code+ai", scope: "all", rule: "Write email, and our name as Mailchimp.", guideline: "", good: "", bad: "", status: "approved", version: 1, params: { preferred_terms: { "e-mail": "email", MailChimp: "Mailchimp" } } } as unknown as Rule);
    const found = runCodeChecks({ input: post({ caption: "Leverage our AUTOMAGICAL tools and start crushing it. MailChimp makes E-mail easy, and Mailchimp says so. #RideKiro" }), rules: withLists, facts: [], brand, today: "2026-11-14" });
    const banned = found.filter((f) => f.rule_id === "WORD-17").flatMap((f) => f.quotes);
    expect(banned).toEqual(expect.arrayContaining(["Leverage", "AUTOMAGICAL", "crushing it"]));
    const pref = found.find((f) => f.rule_id === "WORD-11");
    expect(pref?.fix).toEqual({ kind: "replace", pairs: [{ from: "E-mail", to: "Email" }, { from: "MailChimp", to: "Mailchimp" }] });
  });

  it("doesn't treat common acronyms as shouting", () => {
    expect(ids(post({ caption: "See the ROI of SMS and API reports in a PDF. #RideKiro" }))).toEqual([]);
  });

  it("compares percentages and counts written as words with the Fact Bank", () => {
    const facts = [{ id: "F-01", product: "Kiro One", fact: "The Free plan includes up to 250 contacts and 500 email sends per month.", source: "Pricing page", valid_until: "2027-12-31", type: "general" }];
    const quotes = (caption: string) => runCodeChecks({ input: post({ caption }), rules, facts, brand, today: "2026-11-14" }).filter((f) => f.rule_id === "CLAIM-02").flatMap((f) => f.quotes);
    expect(quotes("Now 2,000 contacts and 10,000 email sends. #RideKiro")).toEqual(expect.arrayContaining(["2,000 contacts", "10,000 email sends"]));
    expect(quotes("Up to 250 contacts and 500 email sends. #RideKiro")).toEqual([]);
    expect(quotes("Open rates went up 30 percent. #RideKiro")).toEqual(["30 percent"]);
  });

  it("doesn't call ordinary words health claims", () => {
    expect(ids(post({ caption: "Secure parking and tasty treats at every Kiro store. #RideKiro" }))).toEqual([]);
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

  it("a contrast problem on a brand without a palette still suggests a colour that reads, so it can be recoloured", () => {
    const image = { src: "/demo/x.png", alt_text: "A slide", analysis: { ocr_text: "Made for riders", lines: [{ text: "Made for riders", contrast: 1.2, fg: "#F3E9A6", bg: "#FFFFFF", large: true }], dominant: [] } };
    const f = run(post({ caption: "New colours.", images: [image] })).find((x) => x.rule_id === "READ-01");
    expect(f?.fix.kind).toBe("manual");
    expect(f?.fix.kind === "manual" && f.fix.advice).toMatch(/Change the text colour to near-black #111111/);
  });
});
