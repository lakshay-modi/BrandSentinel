// Hides personal and confidential details before anything is sent to the AI, and puts them back
// in the AI's answer. The AI only ever sees placeholders like [EMAIL 1] or [PHONE 1].

export interface Redaction {
  text: string;
  /** placeholder → original */
  map: Map<string, string>;
}

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Indian mobile numbers (+91 / 0 prefix, spaces or dashes) and other long phone numbers
  { label: "PHONE", re: /(?<![\w₹])(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9}\d(?!\w)/g },
];

/** Replaces emails, phone numbers and the brand's confidential terms with numbered placeholders. */
export function createRedactor(confidentialTerms: string[] = []) {
  const map = new Map<string, string>();
  const reverse = new Map<string, string>();
  const counters: Record<string, number> = {};
  const placeholder = (label: string, original: string) => {
    const key = `${label}:${original.toLowerCase()}`;
    const known = reverse.get(key);
    if (known) return known;
    counters[label] = (counters[label] ?? 0) + 1;
    const p = `[${label} ${counters[label]}]`;
    map.set(p, original);
    reverse.set(key, p);
    return p;
  };
  const terms = confidentialTerms
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .sort((a, b) => b.length - a.length);
  const termRe = terms.length ? new RegExp(`\\b(?:${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi") : null;

  return {
    map,
    redact(text: string): string {
      let out = text;
      if (termRe) out = out.replace(termRe, (m) => placeholder("CONFIDENTIAL", m));
      for (const { label, re } of PATTERNS) out = out.replace(re, (m) => placeholder(label, m));
      return out;
    },
  };
}

/** Puts the original values back into every string of an AI answer. */
export function restore<T>(value: T, map: Map<string, string>): T {
  if (!map.size) return value;
  const fix = (s: string) => {
    let out = s;
    for (const [p, original] of map) out = out.split(p).join(original);
    return out;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
