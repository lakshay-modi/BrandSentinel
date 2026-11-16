// Applying a suggested fix to the caption. Pure functions, shared by the UI and tests.
import type { Fix } from "./types";

function tidy(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,;:])\s*([,.!?;:])/g, "$2")
    .replace(/^[\s,;:]+/, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/** Inserts text before the trailing hashtags, so "T&C apply." doesn't land after them. */
function addEnd(caption: string, text: string): string {
  const m = caption.match(/(\s+(?:#[\p{L}\p{N}_]+\s*)+)$/u);
  if (!m || text.trim().startsWith("#")) return caption.trimEnd() + text;
  const body = caption.slice(0, caption.length - m[0].length).trimEnd();
  const sep = /[.!?]$/.test(body) ? "" : ".";
  return body + sep + text.replace(/^\s*/, " ") + m[0];
}

/** A replacement that is a full statement of its own: starts like one and has a verb ("our box is made from…"). */
function isStatement(text: string): boolean {
  return /^(?:our|we|the|this|these|it|each|every|all)\b/i.test(text.trim()) && /\b(?:is|are|was|were|has|have)\b/i.test(text) && text.trim().split(/\s+/).length >= 4;
}

export function canApply(fix: Fix): boolean {
  return fix.kind === "replace" || fix.kind === "remove" || fix.kind === "add_start" || fix.kind === "add_end";
}

/** Returns the new caption, or null if the text to change is no longer there. */
export function applyFix(caption: string, fix: Fix): string | null {
  switch (fix.kind) {
    case "replace": {
      let out = caption;
      for (const { from, to } of fix.pairs) {
        const i = out.indexOf(from);
        if (i < 0) return null;
        let before = out.slice(0, i);
        let after = out.slice(i + from.length);
        // A fix that is a whole statement ("our outer box is made from recyclable paperboard") replacing a describing
        // word ("eco-friendly pack.") would leave the described word dangling and run two statements together.
        if (isStatement(to)) {
          // drop the one word the old text described, when it ends the sentence: "…paperboard pack." → "…paperboard."
          after = after.replace(/^ [\p{Ll}]+(?=\s*(?:[.!?]|$))/u, "");
          // "100% natural, our outer box is…" → "100% natural. Our outer box is…"
          const lead = before.match(/([^.!?]*), $/);
          if (lead && lead[1].trim().split(/\s+/).length >= 2) before = before.slice(0, -2) + ". ";
        }
        // a fix that lands at the start of a sentence starts with a capital ("Great! made with…" → "Made with…")
        const atStart = /(^|[.!?]\s+)$/.test(before);
        const text = atStart && /^\p{Ll}/u.test(to) ? to.charAt(0).toUpperCase() + to.slice(1) : to;
        out = before + text + after;
      }
      return tidy(out);
    }
    case "remove": {
      let out = caption;
      for (const q of fix.quotes) {
        const i = out.indexOf(q);
        if (i < 0) return null;
        out = out.slice(0, i) + out.slice(i + q.length);
      }
      return tidy(out);
    }
    case "add_start":
      return caption.toLowerCase().startsWith(fix.text.trim().toLowerCase()) ? caption : fix.text + caption.trimStart();
    case "add_end":
      return caption.toLowerCase().includes(fix.text.trim().toLowerCase()) ? caption : addEnd(caption, fix.text);
    default:
      return null;
  }
}

export function describeFix(fix: Fix): string {
  switch (fix.kind) {
    case "replace":
      return fix.pairs.map((p) => `“${p.from}” → “${p.to}”`).join(", ");
    case "remove":
      return `Remove ${fix.quotes.map((q) => `“${q}”`).join(", ")}`;
    case "add_start":
      return `Add “${fix.text.trim()}” at the start`;
    case "add_end":
      return `Add “${fix.text.trim()}”`;
    case "alt_text":
      return `Alt text: “${fix.text}”`;
    case "manual":
      return fix.advice;
  }
}
