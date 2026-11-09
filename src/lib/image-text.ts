// Plain text logic for rewriting a line of text inside an image: finding the line(s) a quote is on,
// swapping the words, and wrapping the new words back over the same lines. No browser code, so it is tested.

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}₹%'#&]+/gu, " ")
    .trim();

/** The consecutive lines whose text contains the quote (most quotes sit on one line; some run over two or three). */
export function findLineRun(lines: string[], quote: string): { start: number; end: number } | null {
  const q = norm(quote);
  if (!q) return null;
  const qTight = q.replace(/\s+/g, "");
  // first look for the words as written; only then allow missing spaces (text read from images sometimes drops them)
  for (const tight of [false, true])
    for (let len = 1; len <= Math.min(4, lines.length); len++)
      for (let start = 0; start + len <= lines.length; start++) {
        const joined = norm(lines.slice(start, start + len).join(" "));
        if (tight ? joined.replace(/\s+/g, "").includes(qTight) : ` ${joined} `.includes(` ${q} `)) return { start, end: start + len - 1 };
      }
  return null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The text with the quote swapped for the replacement. Matching ignores case and differences in spaces and
 * punctuation between words, as text read from an image often has small differences there.
 */
export function replaceQuote(text: string, quote: string, replacement: string): string | null {
  const words = norm(quote).split(" ").filter(Boolean);
  if (!words.length) return null;
  // words apart first, then allow a missing space
  const m = text.match(new RegExp(words.map(escape).join("[^\\p{L}\\p{N}₹%#&]+"), "iu")) ?? text.match(new RegExp(words.map(escape).join("[^\\p{L}\\p{N}₹%#&]*"), "iu"));
  if (!m || m.index === undefined) return null;
  const out = (text.slice(0, m.index) + replacement + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, " ").trim();
  // nothing but leftover punctuation means the line is removed
  return /[\p{L}\p{N}]/u.test(out) ? out : "";
}

/**
 * Puts words back onto the same number of lines, filling each in turn.
 * `fits(lineIndex, text)` says whether a candidate line fits its space. Returns null when the words don't fit.
 */
export function wrapIntoLines(text: string, count: number, fits: (line: number, text: string) => boolean): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (count === 1) return fits(0, words.join(" ")) ? [words.join(" ")] : null;
  const out: string[] = [];
  let i = 0;
  for (let line = 0; line < count; line++) {
    let current = "";
    const last = line === count - 1;
    while (i < words.length) {
      const next = current ? `${current} ${words[i]}` : words[i];
      if (!fits(line, next)) break;
      current = next;
      i++;
      // leave at least one word for each line that follows when there are enough words
      if (!last && words.length - i <= count - line - 1) break;
    }
    if (!current && i < words.length) return null; // a single word is too wide for this line
    out.push(current);
  }
  return i === words.length ? out : null;
}
