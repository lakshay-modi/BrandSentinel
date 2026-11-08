// The proof check: plain code that decides which AI findings may be shown.
// A finding survives only if its rule exists, its quote really is in the post, and every cited fact exists.
import type { AskHuman, Fact, Finding, Fix, Location, PostInput, Rule } from "../types";
import type { AiResponse } from "./prompt";

const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();

function textAt(input: PostInput, location: string): string | null {
  if (location === "caption") return input.caption;
  const m = location.match(/^image\s*(\d+)$/i);
  if (!m) return null;
  return input.images[Number(m[1]) - 1]?.analysis?.ocr_text ?? null;
}

/** Finds which location contains the quote (prefers the one the AI said). */
function locate(input: PostInput, said: string, quote: string): Location | null {
  const q = norm(quote);
  const candidates = [said, "caption", ...input.images.map((_, i) => `image ${i + 1}`)];
  for (const loc of candidates) {
    const t = textAt(input, loc);
    if (t && norm(t).includes(q)) return (loc === "caption" ? "caption" : `image ${Number(loc.replace(/\D/g, ""))}`) as Location;
  }
  return null;
}

/** Returns the exact original spelling of a quote (the AI may change quotes or case). */
function original(input: PostInput, location: Location, quote: string): string {
  const t = textAt(input, location) ?? "";
  const i = norm(t).indexOf(norm(quote));
  if (i < 0) return quote;
  // map back by searching case-insensitively in the raw text
  const re = new RegExp(quote.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+").replace(/['\u2018\u2019]/g, "['\u2018\u2019]"), "i");
  return t.match(re)?.[0] ?? quote;
}

const overlaps = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};
/** Nearly the same text (one contains the other and they are similar in length). */
const sameText = (a: string, b: string) => overlaps(a, b) && Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.6;

export interface ProofResult {
  findings: Finding[]; // merged code + accepted AI findings
  ask_human: AskHuman[];
  dropped: number; // AI findings rejected by the proof check
}

export function proofCheck(ai: AiResponse, codeFindings: Finding[], input: PostInput, rules: Map<string, Rule>, facts: Fact[]): ProofResult {
  const factIds = new Set(facts.map((f) => f.id));
  const merged: Finding[] = codeFindings.map((f) => ({ ...f, quotes: [...f.quotes] }));
  const ask: AskHuman[] = [];
  let dropped = 0;

  for (const a of ai.findings) {
    const rule = rules.get(a.rule_id.trim().toUpperCase());
    const quote = a.quote.trim();
    // 1. the rule must exist, be approved and allow AI checks
    if (!rule || rule.status !== "approved" || !rule.check_type.includes("ai")) {
      // a code-only rule the fast checks already flagged on this text: the AI agrees, nothing new to show
      const agreed = rule && quote && merged.find((f) => f.rule_id === rule.id && f.quotes.some((q) => overlaps(q, quote)));
      if (agreed) {
        agreed.source = "code+ai";
        continue;
      }
      dropped++;
      const where = quote ? locate(input, a.location, quote) : null;
      if (quote && where) ask.push({ quote, location: where, note: `The AI suggested a problem under “${a.rule_id}”, which isn't an approved AI-checked rule. ${a.message}` });
      continue;
    }
    // 2. the quote must really be in the post (READ-02 is about a missing description, so it has no quote)
    const location = quote ? locate(input, a.location, quote) : a.location.startsWith("image") ? (a.location as Location) : null;
    if (quote && !location) {
      dropped++;
      continue;
    }
    // 3. cited facts must exist
    const badFacts = a.fact_ids.filter((id) => !factIds.has(id));
    if (badFacts.length) {
      dropped++;
      ask.push({ quote, location: location ?? "caption", note: `The AI cited facts that don't exist (${badFacts.join(", ")}). ${a.message}` });
      continue;
    }
    const loc = location ?? "caption";
    const exact = quote ? original(input, loc, quote) : "";
    // 4. already covered by a code finding on the same text? Then enrich it instead of adding a duplicate.
    // Same rule + overlapping text = the same problem. Different rule + nearly the same text = already shown.
    const same = merged.find((f) => f.location === loc && f.rule_id === rule.id && f.quotes.some((q) => overlaps(q, exact)));
    if (same) {
      same.source = "code+ai";
      if (same.fix.kind === "manual" && a.fix !== null && exact) same.fix = { kind: "replace", pairs: [{ from: exact, to: a.fix }] };
      continue;
    }
    if (exact && merged.some((f) => f.location === loc && f.quotes.some((q) => sameText(q, exact)))) continue;
    const sameRuleMissing = !exact && merged.find((f) => f.rule_id === rule.id && f.location === loc);
    if (sameRuleMissing) continue;

    const fix: Fix =
      exact && a.fix !== null
        ? a.fix === ""
          ? { kind: "remove", quotes: [exact] }
          : { kind: "replace", pairs: [{ from: exact, to: a.fix }] }
        : { kind: "manual", advice: a.fix_advice || "Rewrite this part to follow the rule." };
    merged.push({
      id: "",
      rule_id: rule.id,
      category: rule.category,
      severity: rule.severity, // severity always comes from the rule, never from the AI
      location: loc,
      quotes: exact ? [exact] : [],
      message: a.message || rule.rule,
      evidence: rule.rule,
      fact_ids: a.fact_ids,
      fix,
      source: "ai",
    });
  }

  // AI replacements for code findings that only had advice
  for (const cf of ai.code_fixes) {
    const f = merged.find((x) => x.id === cf.finding);
    if (!f || f.fix.kind !== "manual" || !cf.fix.trim()) continue;
    const q = cf.quote.trim() || f.quotes[0];
    if (q && f.quotes.some((x) => overlaps(x, q))) f.fix = { kind: "replace", pairs: [{ from: original(input, f.location, q), to: cf.fix }] };
  }

  // alt text suggestions fill the READ-02 fixes
  for (const alt of ai.alt_text) {
    const f = merged.find((x) => x.rule_id === "READ-02" && x.location === `image ${alt.image}`);
    if (f && alt.text.trim()) f.fix = { kind: "alt_text", text: alt.text.trim() };
  }

  for (const h of ai.ask_human) {
    const loc = h.quote ? locate(input, h.location, h.quote) : null;
    if (h.quote && !loc) continue;
    if (h.quote && merged.some((f) => f.quotes.some((q) => overlaps(q, h.quote)))) continue;
    ask.push({ quote: h.quote, location: loc ?? "caption", note: h.note });
  }

  return { findings: merged, ask_human: ask, dropped };
}
