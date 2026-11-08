// Fast checks: plain code, no AI. Same input always gives the same result.
import type { BrandSettings, Fact, Finding, Fix, Location, PostInput, Rule } from "../types";
import { clauseAround, comparisonAround, emojis, escapeRegex, findAll, findPhrases, formatDate, hashtags, phraseRegex, type Match } from "./text-utils";
import { extractNumbers, sameNumber } from "./numbers";

export interface CheckContext {
  input: PostInput;
  rules: Map<string, Rule>;
  facts: Fact[];
  brand: BrandSettings;
  today: string; // YYYY-MM-DD
}

interface Source {
  location: Location;
  text: string;
}

/** One problem spotted at one place in the text. */
interface Hit {
  quote: string;
  message: string;
  to?: string | null; // replacement text, if a simple swap fixes it
  fact_ids?: string[];
  evidence?: string;
  advice?: string;
}

const DEFAULT_ACRONYMS = ["MRP", "FSSAI", "ASCI", "CCPA", "GST", "UPI", "COD", "EMI", "FAQ", "USA", "UK", "AI", "ID", "OTP", "QR", "DM", "IST"];

/** Text sources: the caption plus the text read from each image. */
function sources(input: PostInput): Source[] {
  const out: Source[] = [{ location: "caption", text: input.caption }];
  input.images.forEach((img, i) => {
    const t = img.analysis?.ocr_text?.trim();
    if (t) out.push({ location: `image ${i + 1}`, text: t });
  });
  return out;
}

function activeRule(ctx: CheckContext, id: string): Rule | null {
  const r = ctx.rules.get(id);
  if (!r || r.status !== "approved" || !r.check_type.includes("code")) return null;
  return r;
}

function finding(rule: Rule, location: Location, quotes: string[], message: string, fix: Fix, extra: Partial<Finding> = {}): Finding {
  return { id: "", rule_id: rule.id, category: rule.category, severity: rule.severity, location, quotes, message, evidence: rule.rule, fact_ids: [], fix, source: "code", ...extra };
}

function fixFor(hits: Hit[], fallbackAdvice: string): Fix {
  if (hits.every((h) => h.to)) return { kind: "replace", pairs: hits.map((h) => ({ from: h.quote, to: h.to! })) };
  if (hits.every((h) => h.to === null)) return { kind: "remove", quotes: hits.map((h) => h.quote) };
  return { kind: "manual", advice: hits.find((h) => h.advice)?.advice ?? fallbackAdvice };
}

/**
 * Low-severity formatting issues become one finding per rule and place (listing every quote).
 * Medium and high issues become one finding per quote, so each can be fixed or disputed on its own.
 */
function report(out: Finding[], rule: Rule, src: Source, hits: Hit[], groupTitle: string, advice = "Rewrite this part to follow the rule.") {
  const unique = hits.filter((h, i) => hits.findIndex((x) => x.quote === h.quote) === i);
  if (!unique.length) return;
  if (rule.severity === "low") {
    const msg = unique.length === 1 ? unique[0].message : `${groupTitle}: ${unique.map((h) => `“${h.quote}”`).join(", ")}.`;
    out.push(finding(rule, src.location, unique.map((h) => h.quote), msg, fixFor(unique, advice)));
    return;
  }
  for (const h of unique) {
    out.push(
      finding(rule, src.location, [h.quote], h.message, fixFor([h], h.advice ?? advice), {
        fact_ids: h.fact_ids ?? [],
        evidence: h.evidence ?? rule.rule,
      }),
    );
  }
}

const startsSentence = (text: string, index: number) => index === 0 || /[.!?]\s*$/.test(text.slice(0, index));
const keepCase = (original: string, replacement: string) =>
  original[0] === original[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;

/** Does a fact apply to this product? "All products" and "(all flavours)" facts apply widely. */
export function factCoversProduct(fact: Fact, product: string): boolean {
  const fp = fact.product.toLowerCase();
  if (fp.startsWith("all products") || fp === "brand") return true;
  const stop = new Set(["oatvia", "all", "flavours", "flavors"]);
  const words = fp.replace(/[()]/g, " ").split(/\s+/).filter((w) => w && !stop.has(w));
  const p = product.toLowerCase();
  return words.length > 0 && words.every((w) => p.includes(w));
}

export function offerFacts(facts: Fact[]) {
  return facts
    .filter((f) => f.type === "offer")
    .map((f) => ({ fact: f, code: f.fact.match(/code\s+([A-Z0-9]{4,})/)?.[1] ?? "", pct: f.fact.match(/(\d+)%\s*off/)?.[1] ?? null }))
    .filter((o) => o.code);
}

export function runCodeChecks(ctx: CheckContext): Finding[] {
  const { input, brand, facts, today } = ctx;
  const out: Finding[] = [];
  const srcs = sources(input);
  const caption = srcs[0];
  const allText = srcs.map((s) => s.text).join("\n");
  const offers = offerFacts(facts);
  const tags = hashtags(caption.text);
  let r: Rule | null;

  // ---------------- Tone ----------------
  if ((r = activeRule(ctx, "TONE-01"))) {
    for (const s of srcs)
      report(out, r, s, findPhrases(s.text, r.params.pressure_phrases ?? []).map((m) => ({
        quote: m.text,
        message: `“${m.text}” puts pressure on the reader. Our tone is friendly and calm.`,
        to: "Pick yours up today",
      })), "Pressure language");
  }

  if ((r = activeRule(ctx, "TONE-02"))) {
    const count = (caption.text.match(/!/g) ?? []).length;
    const launch = input.post_type.toLowerCase().includes("launch");
    const limit: number = launch ? r.params.max_exclamations_launch ?? 2 : r.params.max_exclamations ?? 1;
    if (count > limit) {
      // fix: keep the first allowed "!" (one at a time), turn the rest into full stops
      let budget = limit;
      const pairs: { from: string; to: string }[] = [];
      for (const m of caption.text.matchAll(/[^\s!]*!+/g)) {
        const word = m[0].replace(/!+$/, "");
        const keep = budget > 0;
        if (keep) budget--;
        const to = word + (keep ? "!" : ".");
        if (to !== m[0] && !pairs.some((p) => p.from === m[0])) pairs.push({ from: m[0], to });
      }
      const advice = `Keep at most ${limit} exclamation mark${limit > 1 ? "s" : ""} and never two in a row.`;
      out.push(finding(r, "caption", [], `${count} exclamation marks; the limit is ${limit}${launch ? " for launch posts" : ""}.`, pairs.length ? { kind: "replace", pairs } : { kind: "manual", advice }));
    }
  }

  if ((r = activeRule(ctx, "TONE-03"))) {
    const allowed = new Set<string>([...(r.params.allowed_caps ?? []), ...DEFAULT_ACRONYMS, ...offers.map((o) => o.code)]);
    for (const s of srcs) {
      const caps = findAll(s.text, /(?<![#@\w&])[A-Z]{2,}(?![\w&])/g).filter((m) => !allowed.has(m.text) && !brand.product_misspellings.includes(m.text));
      report(out, r, s, caps.map((m) => ({
        quote: m.text,
        message: `Word in capitals: “${m.text}”. Don't use capitals for emphasis.`,
        to: startsSentence(s.text, m.index) ? m.text[0] + m.text.slice(1).toLowerCase() : m.text.toLowerCase(),
      })), "Words in capitals");
    }
  }

  if ((r = activeRule(ctx, "TONE-04"))) {
    for (const s of srcs)
      report(out, r, s, findPhrases(s.text, r.params.banned ?? []).map((m) => ({
        quote: m.text,
        message: `“${m.text}” suggests food guilt or body shaming. Food is never good or bad.`,
        to: null,
      })), "Food guilt");
  }

  if ((r = activeRule(ctx, "TONE-05"))) {
    const limit = (r.params.max_emojis ?? {})[input.channel] as number | undefined;
    const found = emojis(caption.text);
    if (limit !== undefined && found.length > limit)
      out.push(finding(r, "caption", [], `${found.length} emojis (${found.join(" ")}) on ${input.channel === "linkedin" ? "LinkedIn" : "Instagram"}; the limit is ${limit}.`, {
        kind: "manual",
        advice: `Keep at most ${limit} emoji${limit > 1 ? "s" : ""}.`,
      }));
  }

  // ---------------- Words ----------------
  if ((r = activeRule(ctx, "WORD-01"))) {
    const correct = (bad: string) => {
      const b = bad.toLowerCase().replace(/[\s-]/g, "");
      if (b.includes("milk")) return "Oat Milk";
      if (b.startsWith("pro")) return "ProBar";
      return "Oatvia";
    };
    for (const s of srcs) {
      const listed = brand.product_misspellings.flatMap((w) => findAll(s.text, new RegExp(`(?<![#@\\w.])${escapeRegex(w)}(?!\\w)`, "g")));
      const generic = findAll(s.text, /(?<![#@\w./])(?:oat[\s-]?via|pro[\s-]?bar)(?!\w|\.in\b)/gi).filter((m) => m.text !== "Oatvia" && m.text !== "ProBar");
      const seen = new Set<number>();
      const ms = [...listed, ...generic].filter((m) => !seen.has(m.index) && seen.add(m.index));
      report(out, r, s, ms.map((m) => ({ quote: m.text, message: `“${m.text}” is not how we spell our name. It's “${correct(m.text)}”.`, to: correct(m.text) })), "Misspelled names");
    }
  }

  if ((r = activeRule(ctx, "WORD-02"))) {
    for (const s of srcs)
      report(out, r, s, findPhrases(s.text, r.params.banned ?? []).map((m) => ({
        quote: m.text,
        message: `“${m.text}” is a banned word: it's misleading or not allowed for food.`,
        to: null,
      })), "Banned words");
  }

  if ((r = activeRule(ctx, "WORD-03"))) {
    const rep: Record<string, string> = r.params.replacements ?? {};
    for (const s of srcs)
      report(out, r, s, findPhrases(s.text, Object.keys(rep)).map((m) => {
        const to = keepCase(m.text, rep[m.text.toLowerCase()]);
        return { quote: m.text, message: `US spelling “${m.text}”: write “${to}”.`, to };
      }), "US spellings (use Indian English)");
  }

  if ((r = activeRule(ctx, "WORD-04"))) {
    for (const s of srcs) {
      const ms = [...findAll(s.text, /\b(?:Rs\.?|INR)\s*\d[\d,]*/gi), ...findAll(s.text, /₹\s+\d[\d,]*/g)];
      report(out, r, s, ms.map((m) => {
        const to = "₹" + m.text.replace(/^(?:Rs\.?|INR|₹)\s*/i, "");
        return { quote: m.text, message: `Price “${m.text}” should be written “${to}”.`, to };
      }), "Price format (write ₹99)");
    }
  }

  if ((r = activeRule(ctx, "WORD-05"))) {
    for (const s of srcs) {
      const ms = [...findAll(s.text, /\b\d+(?:\.\d+)?\s?(?:gms|gm|grams|gram)\b/gi), ...findAll(s.text, /\b\d+(?:\.\d+)?(?:g|mg|kg|ml|kcal)\b/gi)];
      report(out, r, s, ms.map((m) => {
        const [, n, u = ""] = m.text.match(/^(\d+(?:\.\d+)?)\s?([a-z]+)$/i) ?? [];
        const unit = /^(gms|gm|grams|gram)$/i.test(u) ? "g" : u.toLowerCase();
        const to = n ? `${n} ${unit}` : null;
        return { quote: m.text, message: `Unit “${m.text}” should be written “${to}”.`, to };
      }), "Unit format (write 20 g)");
    }
  }

  if ((r = activeRule(ctx, "WORD-06")) && input.channel === "instagram" && !caption.text.toLowerCase().includes(brand.brand_hashtag.toLowerCase())) {
    out.push(finding(r, "caption", [], `Instagram posts must include ${brand.brand_hashtag}.`, { kind: "add_end", text: ` ${brand.brand_hashtag}` }));
  }

  if ((r = activeRule(ctx, "WORD-07")) && tags.length > 5) {
    out.push(finding(r, "caption", [], `${tags.length} hashtags; the limit is 5.`, { kind: "manual", advice: "Keep the 5 most relevant hashtags, including the brand hashtag." }));
  }

  if ((r = activeRule(ctx, "WORD-08"))) {
    const terms = (brand.confidential_terms ?? []).filter((t) => t.trim().length >= 3);
    for (const s of srcs) {
      const hits = terms.flatMap((t) => findAll(s.text, new RegExp(`\\b${t.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")));
      report(out, r, s, hits.map((m) => ({
        quote: m.text,
        message: `“${m.text}” is a confidential internal name and must not appear in a post.`,
        advice: "Remove the internal name, for example say “something new is coming soon”.",
      })), "Confidential names", "Remove the internal name.");
    }
  }

  // ---------------- Claims ----------------
  if ((r = activeRule(ctx, "CLAIM-01"))) {
    const pats: string[] = r.params.patterns ?? [];
    for (const s of srcs) {
      const clauses: string[] = [];
      for (const m of pats.flatMap((p) => findAll(s.text, new RegExp(p, "gi")))) {
        const c = clauseAround(s.text, m);
        if (!clauses.some((k) => k.includes(c) || c.includes(k))) clauses.push(c);
      }
      report(out, r, s, clauses.map((c) => ({
        quote: c,
        message: `“${c}” is a ranking or superlative, and no approved fact supports it.`,
        evidence: `${r!.rule} The Fact Bank has no ranking or award facts.`,
        advice: "Describe what the product is (an approved fact) instead of ranking it.",
      })), "Rankings");
    }
  }

  if ((r = activeRule(ctx, "CLAIM-02"))) {
    const factNums = facts.flatMap((f) => extractNumbers(f.fact).map((n) => ({ ...n, fact: f })));
    for (const s of srcs) {
      const unknown = extractNumbers(s.text).filter((n) => !(n.unit === "%" && n.value === 100) && !factNums.some((f) => sameNumber(f, n)));
      report(out, r, s, unknown.map((n) => {
        const best = factNums.filter((f) => f.unit === n.unit).sort((a, b) => Math.abs(a.value - n.value) - Math.abs(b.value - n.value))[0];
        return {
          quote: n.text,
          message: best
            ? `“${n.text}” doesn't match any approved fact. Closest: ${best.fact.id} says “${best.fact.fact}”`
            : `“${n.text}” doesn't match any approved fact.`,
          fact_ids: best ? [best.fact.id] : [],
          to: best && best.unit !== "₹" ? best.text : undefined,
          advice: best ? `Use the approved number from ${best.fact.id}, or remove it.` : "Remove this number or add it to the Fact Bank with a source.",
        };
      }), "Numbers not in the Fact Bank");
    }
  }

  if ((r = activeRule(ctx, "CLAIM-03"))) {
    const env = facts.find((f) => f.type === "environment");
    for (const s of srcs)
      report(out, r, s, findPhrases(s.text, r.params.phrases ?? []).map((m) => ({
        quote: m.text,
        message: `“${m.text}” is an environmental claim we can't prove.${env ? ` The only approved one: “${env.fact.split(".")[0]}.”` : ""}`,
        fact_ids: env ? [env.id] : [],
        advice: env ? `Only say: “${env.fact.split(".")[0].toLowerCase()}”.` : "Remove this claim.",
      })), "Environmental claims");
  }

  if ((r = activeRule(ctx, "CLAIM-04"))) {
    for (const s of srcs)
      report(out, r, s, findPhrases(s.text, r.params.phrases ?? []).map((m) => ({
        quote: m.text,
        message: `“${m.text}” is a health or medical claim. Our products are food, not medicine.`,
        advice: "Remove the health claim; describe the food instead (for example its protein).",
      })), "Health claims");
  }

  if ((r = activeRule(ctx, "CLAIM-05"))) {
    const terms: Record<string, string> = r.params.diet_terms ?? {};
    const product = input.product || "this product";
    for (const s of srcs) {
      const hits: Hit[] = [];
      for (const m of findPhrases(s.text, Object.keys(terms))) {
        const canon = terms[Object.keys(terms).find((k) => k.toLowerCase() === m.text.toLowerCase()) ?? ""];
        const synonyms = Object.keys(terms).filter((k) => terms[k] === canon);
        const mentions = facts.filter((f) => synonyms.some((syn) => phraseRegex(syn, "i").test(f.fact)));
        const negative = (f: Fact) => synonyms.some((syn) => new RegExp(`\\b(?:not|non)[\\s-]+${escapeRegex(syn)}`, "i").test(f.fact));
        const supports = mentions.filter((f) => !negative(f) && factCoversProduct(f, product));
        if (supports.length) continue;
        const against = mentions.find((f) => negative(f) && factCoversProduct(f, product));
        const other = mentions.find((f) => !negative(f));
        hits.push({
          quote: m.text,
          message: against
            ? `“${m.text}” is wrong: ${against.id} says “${against.fact}”`
            : `“${m.text}” isn't supported for ${product} by any approved fact.${other ? ` ${other.id} says this only for ${other.product}.` : ""}`,
          fact_ids: [against?.id ?? other?.id].filter((x): x is string => !!x),
          advice: "Remove this claim, or use only what the Fact Bank says for this product.",
        });
      }
      report(out, r, s, hits, "Diet claims");
    }
  }

  if ((r = activeRule(ctx, "CLAIM-06"))) {
    const isOffer = input.post_type.toLowerCase().includes("offer") || /\d+\s?%\s*off|\bcode\b/i.test(allText);
    for (const s of srcs) {
      const hits: Hit[] = [];
      for (const o of offers) {
        for (const m of findAll(s.text, new RegExp(`\\b${o.code}\\b`, "g"))) {
          if (o.fact.valid_until < today) {
            hits.push({
              quote: m.text,
              message: `Code ${m.text} belongs to an offer that ended on ${formatDate(o.fact.valid_until)} (${o.fact.id}). Never promote an offer after its end date.`,
              fact_ids: [o.fact.id],
              advice: "Remove the expired offer or switch to a current approved offer.",
            });
          } else if (o.pct) {
            const pct = s.text.match(/(\d+)\s?%\s*off/i);
            if (pct && pct[1] !== o.pct)
              hits.push({ quote: pct[0], message: `Code ${o.code} gives ${o.pct}% off (${o.fact.id}), not ${pct[1]}%.`, fact_ids: [o.fact.id], to: `${o.pct}% off` });
          }
        }
      }
      if (isOffer)
        for (const m of findAll(s.text, /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g).filter((m) => !offers.some((o) => o.code === m.text)))
          hits.push({ quote: m.text, message: `“${m.text}” isn't an approved offer code.`, advice: "Use the code from a current approved offer." });
      report(out, r, s, hits, "Offer problems");
    }
    if (isOffer && !/t\s?&\s?cs?\s+apply|terms (?:and|&) conditions apply/i.test(allText))
      out.push(finding(r, "caption", [], "Offer posts must say “T&C apply”.", { kind: "add_end", text: " T&C apply." }));
  }

  if ((r = activeRule(ctx, "CLAIM-07"))) {
    for (const s of srcs) {
      const clauses: string[] = [];
      for (const m of findPhrases(s.text, r.params.phrases ?? [])) {
        const c = comparisonAround(s.text, m);
        if (!clauses.some((k) => k.includes(c) || c.includes(k))) clauses.push(c);
      }
      report(out, r, s, clauses.map((c) => ({
        quote: c,
        message: `“${c}” compares us with others. Talk about what we are, not what others aren't.`,
        advice: "Remove the comparison and describe our product on its own.",
      })), "Comparisons");
    }
  }

  if ((r = activeRule(ctx, "CLAIM-08")) && input.partner) {
    const starts: string[] = r.params.starts_with ?? ["#ad", "paid partnership"];
    if (!starts.some((p) => caption.text.trim().toLowerCase().startsWith(p.toLowerCase())))
      out.push(finding(r, "caption", [], "This is a paid or partner post, so it must start with “#ad” or “Paid partnership”.", { kind: "add_start", text: "#ad " }));
  }

  if ((r = activeRule(ctx, "CLAIM-09"))) {
    const when: string[] = r.params.when_mentions ?? [];
    const req: string = r.params.required_text ?? "";
    const about = when.some((w) => `${input.product}\n${allText}`.toLowerCase().includes(w.toLowerCase()));
    if (about && req && !allText.toLowerCase().includes(req.toLowerCase()))
      out.push(finding(r, "caption", [], `Posts about this product must say “${req}”.`, { kind: "add_end", text: ` ${req}.` }, {
        fact_ids: facts.filter((f) => f.type === "allergen").map((f) => f.id),
      }));
  }

  // ---------------- Readability ----------------
  if ((r = activeRule(ctx, "READ-03"))) {
    const brandWords = brand.products.map((p) => p.toLowerCase().replace(/\s/g, ""));
    const bad = tags.filter((t) => t === t.toLowerCase() && /[a-z]/.test(t) && (t.length >= 11 || brandWords.some((w) => w.length > 4 && t.includes(w))));
    if (bad.length) {
      const known = bad.map((t) => (t === brand.brand_hashtag.toLowerCase() ? brand.brand_hashtag : null));
      out.push(finding(r, "caption", bad, `Multi-word hashtags need a capital letter for each word so screen readers can read them: ${bad.join(" ")}.`,
        known.every(Boolean)
          ? { kind: "replace", pairs: bad.map((t, i) => ({ from: t, to: known[i]! })) }
          : { kind: "manual", advice: `Capitalise each word, for example ${known.find(Boolean) ?? "#HealthySnacks"}.` }));
    }
  }

  return out;
}

export type { Match };
