import { createHash } from "node:crypto";
import { z } from "zod";
import { actorSchema, clientId, fail, json, readJson, roleSchema, serverError } from "@/lib/api";
import { db, getBrandContext, getCache, setCache } from "@/lib/db";
import { callGemini, parseJson } from "@/lib/ai/gemini";
import { IMPORT_SYSTEM_PROMPT, buildImportPrompt, parseImportReply, quoteInDocument, type ImportedRule } from "@/lib/ai/import-prompt";
import { allowAiCall } from "@/lib/review/rate-limit";

export const maxDuration = 60;

const PREFIX = { tone: "TONE", words: "WORD", claims: "CLAIM", visuals: "VIS", readability: "READ" } as const;
const MAX_TEXT = 40_000;

const bodySchema = z.object({
  role: roleSchema,
  actor: actorSchema,
  file: z.object({
    name: z.string().trim().min(1).max(160),
    type: z.string().max(100).default(""),
    base64: z.string().min(1).max(4_000_000, "That file is too big. Use a PDF under 3 MB."),
  }),
});

async function documentText(name: string, type: string, base64: string): Promise<{ text: string; pages: number }> {
  const bytes = Buffer.from(base64, "base64");
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(name) || bytes.subarray(0, 5).toString() === "%PDF-";
  if (!isPdf) return { text: bytes.toString("utf8"), pages: 1 };
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { text: (text as string[]).map((t, i) => `[Page ${i + 1}]\n${t}`).join("\n\n"), pages: totalPages };
}

/**
 * Draft Rulebook entries from a guidelines document (brand manager only).
 * The text is read in plain code, the AI drafts rules, plain code checks every rule's quote is really
 * in the document, and the rules are saved as drafts: they aren't used in checks until approved.
 */
export async function POST(req: Request) {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { role, actor, file } = body.data;
  if (role !== "brand_manager") return fail("Only the brand manager can import rules.", 403);

  let doc: { text: string; pages: number };
  try {
    doc = await documentText(file.name, file.type, file.base64);
  } catch {
    return fail("Couldn't read that file. Upload a text-based PDF, or a .txt or .md file.", 400);
  }
  const text = doc.text.replace(/\u0000/g, "").trim();
  if (text.length < 80) return fail("No readable text found. If the PDF is a scan, export it with selectable text first.", 400);
  const clipped = text.slice(0, MAX_TEXT);

  try {
    const ctx = await getBrandContext();
    const cacheKey = "import:" + createHash("sha256").update(clipped).update(ctx.rules.map((r) => `${r.id}:${r.status}`).join(",")).digest("hex").slice(0, 32);
    let drafted = await getCache<{ rules: ImportedRule[]; model: string }>(cacheKey);
    if (!drafted) {
      if (!allowAiCall(clientId(req))) return fail("The AI is busy (free-tier limit). Try again in a minute.", 429);
      const res = await callGemini(IMPORT_SYSTEM_PROMPT, [{ text: buildImportPrompt(clipped, ctx.rules) }], 56_000, { firstMs: 12_000, laterMs: 42_000 });
      if (!res.ok) return fail(res.status === "off" ? "AI is not set up on this server." : "The AI is busy right now. Try again in a minute.", res.status === "off" ? 503 : 429);
      let raw: unknown = null;
      try {
        raw = parseJson(res.text);
      } catch {
        /* handled below */
      }
      const parsed = parseImportReply(raw);
      if (!parsed) {
        console.error("[rules/import] AI reply had no rule list:", res.text.slice(0, 300));
        return fail("The AI reply wasn't in the expected format. Try again.", 502);
      }
      if (parsed.malformed) console.warn(`[rules/import] dropped ${parsed.malformed} malformed rule(s)`);
      drafted = { rules: parsed.rules, model: res.model };
      await setCache(cacheKey, drafted);
    }

    const existing = new Map(ctx.rules.map((r) => [r.id, r]));
    const sameText = (a: string, b: string) => a.toLowerCase().replace(/\W+/g, " ").trim() === b.toLowerCase().replace(/\W+/g, " ").trim();
    const duplicates: { rule: string; duplicate_of: string }[] = [];
    const unproven: string[] = [];
    const toAdd: ImportedRule[] = [];
    for (const r of drafted.rules) {
      // no proof, no rule: the quoted sentence must really be in the document
      if (!quoteInDocument(r.source_quote, text)) {
        unproven.push(r.rule);
        continue;
      }
      const dup = (r.duplicate_of && existing.get(r.duplicate_of.toUpperCase())) || ctx.rules.find((x) => sameText(x.rule, r.rule));
      if (dup && dup.status !== "rejected") {
        duplicates.push({ rule: r.rule, duplicate_of: dup.id });
        continue;
      }
      if (toAdd.some((x) => sameText(x.rule, r.rule))) continue;
      toAdd.push(r);
    }

    const next: Record<string, number> = {};
    const nextId = (category: keyof typeof PREFIX) => {
      const p = PREFIX[category];
      next[p] ??= Math.max(0, ...ctx.rules.filter((r) => r.id.startsWith(p + "-")).map((r) => Number(r.id.split("-")[1]) || 0));
      next[p] += 1;
      return `${p}-${String(next[p]).padStart(2, "0")}`;
    };
    const rows = toAdd.map((r) => ({
      id: nextId(r.category),
      brand_id: ctx.brand.id,
      category: r.category,
      severity: r.severity,
      check_type: "ai",
      scope: r.scope || "all",
      rule: r.rule,
      guideline: r.guideline,
      good: r.good,
      bad: r.bad,
      params: {},
      status: "draft",
      source: `${file.name}: “${r.source_quote.slice(0, 220)}”`,
    }));
    if (rows.length) {
      const { error } = await db().from("rules").insert(rows);
      if (error) throw new Error(error.message);
    }
    return json({ added: rows.map((r) => r.id), duplicates, unproven, pages: doc.pages, chars: clipped.length, truncated: text.length > MAX_TEXT, model: drafted.model, actor });
  } catch (e) {
    return serverError(e, "rules/import");
  }
}
