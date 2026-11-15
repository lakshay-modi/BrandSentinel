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

// Characters people use to slip words past filters: invisible ones, and 0 or 3 after a letter ("pr0ven", "N0. 1", "b3st").
const HIDDEN = /[\u200B-\u200D\u2060\uFEFF\u00AD]/;
const LOOKALIKE: Record<string, string> = { "0": "o", "3": "e" };

/**
 * A copy of the text for matching, with the position of each of its characters in the original.
 * Invisible characters are left out, and 0 or 3 right after a letter is read as o or e. With `loose`, it is also
 * lower case, with one space for any run of spaces and plain quote marks, for comparing quotes.
 * Returns null when there is nothing to change (the text can be used as it is).
 */
export function matchView(text: string, loose = false): { view: string; at: number[] } | null {
  const tricky = HIDDEN.test(text) || /[A-Za-z][03](?!\d)/.test(text);
  if (!tricky && !loose) return null;
  let view = "";
  const at: number[] = [];
  const isLetter = (c: string | undefined) => !!c && /[A-Za-z]/.test(c);
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (HIDDEN.test(c)) continue;
    // only right after a letter and not in front of another digit, so numbers like "20g" or "KIRO10" stay numbers
    if (LOOKALIKE[c] && isLetter(text[i - 1]) && !/\d/.test(text[i + 1] ?? "")) c = LOOKALIKE[c];
    if (loose) {
      if (/\s/.test(c)) {
        if (view.endsWith(" ") || view === "") continue;
        c = " ";
      }
      c = c.replace(/[\u2018\u2019]/, "'").replace(/[\u201c\u201d]/, '"').toLowerCase();
    }
    view += c;
    at.push(i);
  }
  return { view, at };
}

/** Maps a match in a view back to the exact characters of the original text. */
function fromView(text: string, at: number[], index: number, length: number): Match {
  const start = at[index];
  const end = at[index + length - 1] + 1;
  return { text: text.slice(start, end), index: start };
}

export function findAll(text: string, re: RegExp): Match[] {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const r = new RegExp(re.source, flags);
  const out: Match[] = [];
  const v = matchView(text);
  for (const m of (v?.view ?? text).matchAll(r)) {
    if (!m[0].length) continue;
    out.push(v ? fromView(text, v.at, m.index ?? 0, m[0].length) : { text: m[0], index: m.index ?? 0 });
  }
  return out;
}

/** Finds a quote in a text loosely (case, spacing, quote marks, invisible characters) and returns the original characters. */
export function findLoose(text: string, quote: string): Match | null {
  const v = matchView(text, true)!;
  const q = matchView(quote, true)!.view.trim();
  if (!q) return null;
  const i = v.view.indexOf(q);
  return i < 0 ? null : fromView(text, v.at, i, q.length);
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

/** A short quote for a comparison: up to two words before the match, to the end of the clause ("way tastier than other snacks"). */
export function comparisonAround(text: string, m: Match): string {
  const clause = clauseAround(text, m);
  const start = text.indexOf(clause);
  const before = text.slice(start, m.index).trimEnd().split(/\s+/).filter(Boolean);
  const lead = before.slice(-2).join(" ");
  const rest = clause.slice(m.index - start);
  return (lead ? lead + " " : "") + rest.trim();
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
