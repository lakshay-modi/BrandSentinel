import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { importResponseSchema, quoteInDocument } from "./import-prompt";

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
});
