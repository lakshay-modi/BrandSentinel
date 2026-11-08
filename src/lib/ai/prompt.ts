// Builds the one AI request per post and defines the exact shape the answer must have.
import { z } from "zod";
import type { Fact, Finding, PostInput, Rule } from "../types";

export const aiResponseSchema = z.object({
  goal: z
    .object({ post_type: z.string().default(""), message: z.string().default(""), call_to_action: z.string().default("") })
    .nullable()
    .default(null),
  findings: z
    .array(
      z.object({
        rule_id: z.string(),
        location: z.string().default("caption"),
        quote: z.string().default(""),
        message: z.string().default(""),
        fact_ids: z.array(z.string()).default([]),
        fix: z.string().nullable().default(null),
        fix_advice: z.string().default(""),
      }),
    )
    .default([]),
  code_fixes: z.array(z.object({ finding: z.string(), quote: z.string().default(""), fix: z.string() })).default([]),
  ask_human: z.array(z.object({ quote: z.string().default(""), location: z.string().default("caption"), note: z.string().default("") })).default([]),
  alt_text: z.array(z.object({ image: z.number(), text: z.string() })).default([]),
  suggested_caption: z.string().nullable().default(null),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

export const SYSTEM_PROMPT = `You are BrandSentinel, a careful brand-compliance reviewer for one brand.
You check a social media post (caption plus text read from its images) against the brand's approved rules and Fact Bank.

Hard rules for your answer:
1. Only report a problem if it breaks one of the listed rules. Never invent rules or facts.
2. Every finding must have "rule_id" from the list and a "quote" copied EXACTLY, character for character, from the post text at that location.
3. Claims findings must list the Fact Bank IDs that prove the problem in "fact_ids" (or [] when no fact supports the claim at all).
4. Do NOT repeat problems already listed under "Already found by code checks". Look for problems the code missed: reworded claims, implied health or green claims, comparisons, pushy tone, wrong facts, claims inside image text.
5. If something might be a problem but no rule clearly covers it, put it in "ask_human" instead of "findings".
6. Fixes must be minimal edits that keep the creator's goal (post type, main message, call to action). "fix" replaces the quote; use "" to delete it; null when the quote can't simply be replaced.
7. For every code finding whose fix is "manual", you may give a replacement in "code_fixes" (finding = its id, quote = the exact text to replace, fix = new text).
8. Write a one-sentence "alt_text" for each image that has no alt text, describing what is visible.
9. "suggested_caption" is the full caption with all fixes applied (code findings and yours), keeping the goal, tone and hashtags that are allowed.
10. Use plain, simple English. Reply with JSON only.

JSON shape:
{"goal":{"post_type":"","message":"","call_to_action":""},
 "findings":[{"rule_id":"","location":"caption | image 1","quote":"","message":"","fact_ids":[],"fix":null,"fix_advice":""}],
 "code_fixes":[{"finding":"","quote":"","fix":""}],
 "ask_human":[{"quote":"","location":"caption","note":""}],
 "alt_text":[{"image":1,"text":""}],
 "suggested_caption":""}`;

/** Picks the facts most related to the post (keyword overlap). Small Fact Banks are sent whole. */
export function relevantFacts(facts: Fact[], text: string, limit = 20): Fact[] {
  if (facts.length <= limit) return facts;
  const words = new Set(text.toLowerCase().match(/[a-z0-9₹%]+/g) ?? []);
  return facts
    .map((f) => ({ f, score: (`${f.product} ${f.fact}`.toLowerCase().match(/[a-z0-9₹%]+/g) ?? []).filter((w) => words.has(w)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

export function buildUserPrompt(opts: {
  brandName: string;
  input: PostInput;
  rules: Rule[];
  facts: Fact[];
  codeFindings: Finding[];
  today: string;
}): string {
  const { brandName, input, rules, facts, codeFindings, today } = opts;
  const imageTexts = input.images.map((img, i) => `image ${i + 1}: text read from image = ${JSON.stringify(img.analysis?.ocr_text ?? "")}; alt text = ${JSON.stringify(img.alt_text)}`);
  const allText = [input.caption, ...input.images.map((i) => i.analysis?.ocr_text ?? "")].join(" ");
  const factLines = relevantFacts(facts, `${input.product} ${allText}`).map(
    (f) => `${f.id} | ${f.product} | ${f.fact} | valid until ${f.valid_until}${f.valid_until < today ? " (EXPIRED)" : ""}`,
  );
  const ruleLines = rules.filter((r) => r.status === "approved").map((r) => `${r.id} [${r.category}, ${r.severity}, scope: ${r.scope}] ${r.rule} — ${r.guideline} Do: ${r.good} Don't: ${r.bad}`);
  const codeLines = codeFindings.map(
    (f) => `${f.id} | ${f.rule_id} | ${f.location} | ${f.quotes.map((q) => JSON.stringify(q)).join(", ") || "(missing text)"} | fix: ${f.fix.kind}`,
  );

  return [
    `Brand: ${brandName}. Today: ${today}.`,
    `Post: channel=${input.channel}; post type=${input.post_type}; product=${input.product || "not given"}; paid/partner post=${input.partner ? "yes" : "no"}.`,
    `Caption: ${JSON.stringify(input.caption)}`,
    imageTexts.length ? `Images:\n${imageTexts.join("\n")}` : "Images: none",
    `Rules:\n${ruleLines.join("\n")}`,
    `Fact Bank:\n${factLines.join("\n")}`,
    `Already found by code checks:\n${codeLines.join("\n") || "(none)"}`,
  ].join("\n\n");
}
