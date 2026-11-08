export interface Match {
  text: string;
  index: number;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex for a phrase that only matches whole words (handles phrases that start or end with symbols). */
export function phraseRegex(phrase: string, flags = "gi"): RegExp {
  const start = /^\w/.test(phrase) ? "(?<![\\w-])" : "";
  const end = /\w$/.test(phrase) ? "(?![\\w-])" : "";
  return new RegExp(start + escapeRegex(phrase) + end, flags);
}

export function findAll(text: string, re: RegExp): Match[] {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const r = new RegExp(re.source, flags);
  const out: Match[] = [];
  for (const m of text.matchAll(r)) {
    if (m[0].length) out.push({ text: m[0], index: m.index ?? 0 });
  }
  return out;
}

/** Find every phrase from a list; when phrases overlap, keep the longest. */
export function findPhrases(text: string, phrases: string[]): Match[] {
  const all = phrases.flatMap((p) => findAll(text, phraseRegex(p)));
  all.sort((a, b) => a.index - b.index || b.text.length - a.text.length);
  const kept: Match[] = [];
  for (const m of all) {
    const last = kept[kept.length - 1];
    if (last && m.index < last.index + last.text.length) continue;
    kept.push(m);
  }
  return kept;
}

/** The clause (text between punctuation) around a match, e.g. "India's No. 1 protein bar". */
export function clauseAround(text: string, m: Match): string {
  const isBreak = (i: number) => {
    const ch = text[i];
    if (ch === "\n" || ch === "!" || ch === "?" || ch === "," || ch === ";" || ch === ":") return true;
    // a full stop ends a clause, but not inside "No. 1" or "Rs. 99"
    if (ch === "." && /\s/.test(text[i + 1] ?? " ") && !/(?:no|rs)$/i.test(text.slice(Math.max(0, i - 3), i))) return true;
    return false;
  };
  let s = m.index;
  while (s > 0 && !isBreak(s - 1)) s--;
  let e = m.index + m.text.length;
  while (e < text.length && !isBreak(e)) e++;
  return text
    .slice(s, e)
    .replace(/\s+#\S+.*$/, "") // drop trailing hashtags
    .trim();
}

export function hashtags(text: string): string[] {
  return findAll(text, /#[\p{L}\p{N}_]+/gu).map((m) => m.text);
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;

export function emojis(text: string): string[] {
  const parts = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
  return parts.filter((g) => /\p{Extended_Pictographic}/u.test(g));
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function todayIST(): string {
  // dates in the Fact Bank are Indian dates
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
