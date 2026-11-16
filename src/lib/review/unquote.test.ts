import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { rewriteKeepsNumbers, unquote } = await import("./run-review");

describe("AI rewrite clean-up", () => {
  it("drops quote marks the AI wraps around the rewrite", () => {
    expect(unquote('"Mailchimp makes email marketing easy."', "MailChimp makes e-mail marketing easy.")).toBe("Mailchimp makes email marketing easy.");
    expect(unquote("“Turn ideas into emails and SMS that connect.”", "Turn ideas into emails & SMS that connect.")).toBe("Turn ideas into emails and SMS that connect.");
  });
  it("keeps quotes that belong to the caption, and plain text as it is", () => {
    expect(unquote('"Best day ever," said Priya.', '"Best day ever," said Priya!')).toBe('"Best day ever," said Priya.');
    expect(unquote("Plain rewrite.", "x")).toBe("Plain rewrite.");
    expect(unquote(null, "x")).toBe("");
  });
  it("drops a rewrite that adds a number the post and the facts don't have", () => {
    const known = ["Our new protein bar is the healthiest snack ever!", "Team O(1)", "All products Plans start at ₹499 a month"];
    expect(rewriteKeepsNumbers("Our new protein bar has 20 g of protein. #TeamO1", known)).toBe(false);
    expect(rewriteKeepsNumbers("Team O(1): plans start at ₹499 a month. #TeamO1 #Study2Win", known)).toBe(true);
    expect(rewriteKeepsNumbers("Save on 1,299 plans", ["Save on 1299 plans"])).toBe(true);
    expect(rewriteKeepsNumbers("Use code KIRO10 today", ["Shop today"])).toBe(true);
  });
});
