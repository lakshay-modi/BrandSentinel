import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { importResponseSchema, parseImportReply, quoteInDocument } from "./import-prompt";

async function addendumText() {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync("public/demo/Oatvia_Social_Addendum.pdf")));
  const { text } = await extractText(pdf, { mergePages: true });
  return text as string;
}

describe("rule import proof", () => {
  it("accepts a quote that is really in the PDF, even across line breaks and curly quotes", async () => {
    const text = await addendumText();
    expect(quoteInDocument("Every call to action must send people to oatvia.in.", text)).toBe(true);
    expect(quoteInDocument("Instagram captions should stay under 220 characters so the main message shows before the ‘more’ cut-off.", text)).toBe(true);
  });

  it("rejects a quote the document doesn't contain", async () => {
    const text = await addendumText();
    expect(quoteInDocument("Posts must always use the colour pink.", text)).toBe(false);
    expect(quoteInDocument("Oatvia", text)).toBe(false); // too short to prove anything
  });

  it("repairs bad AI fields instead of failing the whole import", () => {
    const r = importResponseSchema.parse({ rules: [{ category: "nonsense", severity: "urgent", rule: "Put the product name first.", source_quote: "x" }] });
    expect(r.rules[0]).toMatchObject({ category: "tone", severity: "medium", scope: "all" });
  });

  it("accepts a bare array and drops only the malformed rules", () => {
    const good = { category: "claims", severity: "high", rule: "Never call a product the best.", source_quote: "Never call a product the best" };
    const r = parseImportReply([good, { rule: "x" }, { ...good, rule: "Never compare with other brands." }]);
    expect(r?.rules).toHaveLength(2);
    expect(r?.malformed).toBe(1);
    expect(parseImportReply({ rules: [good] })?.rules).toHaveLength(1);
    expect(parseImportReply({ nothing: true })).toBeNull();
  });
});

describe("splitting a long guidelines document", async () => {
  const { splitDocument } = await import("./import-prompt");
  it("keeps a short document whole", () => {
    expect(splitDocument("Rule one.\n\nRule two.")).toEqual(["Rule one.\n\nRule two."]);
  });
  it("splits a long one at paragraph breaks into at most 8 parts, keeping every paragraph", () => {
    const paras = Array.from({ length: 40 }, (_, i) => `Section ${i + 1}. ${"Words about this rule. ".repeat(20)}`);
    const parts = splitDocument(paras.join("\n\n"));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.length).toBeLessThanOrEqual(8);
    expect(parts.join("\n\n").split("\n\n")).toEqual(paras.map((p) => p.trim()));
  });
  it("splits at line breaks when there are no blank lines", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `Line ${i}: ${"x".repeat(80)}`).join("\n");
    expect(splitDocument(lines).length).toBeGreaterThan(1);
  });
});


describe("word lists in imported rules", async () => {
  const { provenWordLists } = await import("./import-prompt");
  const doc = "Do not use these words: automagical, funnel, leverage. Write email, never e-mail. Write Mailchimp, never MailChimp.";
  it("keeps only words that are really in the document", () => {
    expect(provenWordLists({ banned_phrases: ["funnel", "leverage", "synergy"] }, doc)).toEqual({ banned_phrases: ["funnel", "leverage"] });
    expect(provenWordLists({ preferred_terms: { "e-mail": "email", MailChimp: "Mailchimp", "web site": "website" } }, doc)).toEqual({ preferred_terms: { "e-mail": "email", MailChimp: "Mailchimp" } });
  });
  it("returns nothing when the AI invented every word", () => {
    expect(provenWordLists({ banned_phrases: ["synergy"] }, doc)).toBeNull();
  });
});
