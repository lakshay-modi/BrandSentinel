// The full review pipeline: fast checks → AI checks → proof check → score.
import "server-only";
import { createHash } from "node:crypto";
import type { Finding, PostInput, ReviewResult } from "../types";
import { runCodeChecks } from "../checks/code-checks";
import { runVisualChecks } from "../checks/visual-checks";
import { todayIST } from "../checks/text-utils";
import { aiConfigured, BACKUP_MODEL, backupAvailable, callBackupOnly, callGemini, parseJson, usingSharedAiKey, type AiPart } from "../ai/gemini";
import { aiResponseSchema, buildUserPrompt, SYSTEM_PROMPT, type AiResponse } from "../ai/prompt";
import { proofCheck } from "../ai/proof";
import { createRedactor, restore } from "../ai/redact";
import { assignIds, brandScore } from "./score";
import { getCache, setCache, type BrandContext } from "../db";
import { aiAllowance } from "./rate-limit";

export interface ReviewOutput extends ReviewResult {
  dropped: number;
  /** personal or confidential details hidden from the AI */
  redacted: number;
  ai_detail?: string;
}

async function imagePart(src: string, origin: string): Promise<AiPart | null> {
  try {
    if (src.startsWith("data:")) {
      const [head, base64] = src.split(",");
      return { image: { mimeType: head.slice(5).split(";")[0] || "image/jpeg", base64 } };
    }
    if (src.startsWith("/")) {
      const res = await fetch(origin + src);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return { image: { mimeType: res.headers.get("content-type") ?? "image/png", base64: buf.toString("base64") } };
    }
  } catch {
    /* image is optional for the AI */
  }
  return null;
}

/** Spoken words can't be edited in place: a fix for something said becomes advice to re-record or cut it. */
function spokenFix(f: Finding): Finding {
  if (f.location !== "speech" || f.fix.kind === "manual") return f;
  const to = f.fix.kind === "replace" ? f.fix.pairs.map((p) => p.to).filter(Boolean).join(" … ") : "";
  return { ...f, fix: { kind: "manual", advice: to ? `This is said in the video, so re-record or cut that line. Say instead: “${to}”.` : "This is said in the video, so re-record or cut that line." } };
}

/** The AI sometimes wraps its rewrite in quote marks: drop them, unless the caption itself starts with one. */
export function unquote(text: string | null | undefined, caption: string): string {
  const t = (text ?? "").trim();
  const m = t.match(/^(["“”'])([\s\S]*)(["“”'])$/);
  if (!m || /^["“”']/.test(caption.trim())) return t;
  return m[2].trim();
}

/** Numbers written in a text (1,299 → 1299), leaving out digits glued to a letter before them (KIRO10, #TeamO1). */
function numbersIn(text: string): string[] {
  return [...text.matchAll(/(?<![\p{L}\d#.,])\d+(?:[.,]\d+)*/gu)].map((m) => m[0].replace(/,/g, "").replace(/\.0+$/, ""));
}

/**
 * A suggested rewrite may only use numbers the post or the approved facts already have: an AI that adds a
 * figure ("20 g of protein") would put an unproven claim into the creator's post. Such a rewrite is dropped.
 */
export function rewriteKeepsNumbers(rewrite: string, known: string[]): boolean {
  const allowed = new Set(known.flatMap(numbersIn));
  return numbersIn(rewrite).every((n) => allowed.has(n));
}

export async function runReview(input: PostInput, ctx: BrandContext, opts: { origin: string; clientId: string; /** fast checks only, for checks while typing in other tools */ codeOnly?: boolean; /** send the AI part to the backup AI only, without cache (backup test) */ backupOnly?: boolean; /** with backupOnly: one ASI:One model to test */ backupModel?: string }): Promise<ReviewOutput> {
  const rules = new Map(ctx.rules.map((r) => [r.id, r]));
  const today = todayIST();
  const settings = ctx.brand.settings;

  // 1. fast checks (always run, no AI)
  const code = assignIds([...runCodeChecks({ input, rules, facts: ctx.facts, brand: settings, today }), ...runVisualChecks(input, rules, settings)]);

  // 2. AI checks (one call per post, cached by content)
  let ai: AiResponse | null = null;
  let aiStatus: ReviewResult["ai_status"] = "off";
  let model: string | null = null;
  let detail: string | undefined;
  let redacted = 0;

  if (!opts.codeOnly && aiConfigured()) {
    const factsHash = createHash("sha256").update(JSON.stringify(ctx.facts)).digest("hex").slice(0, 12);
    const cacheKey = createHash("sha256")
      .update(
        JSON.stringify({
          v: 7, // bump when the prompt changes so cached answers are refreshed
          rulebook: ctx.brand.rulebook_version,
          // each company's answers are cached apart (the demo brands keep their earlier cache)
          ...(ctx.brand.settings.protected ? {} : { brand: ctx.brand.id }),
          factsHash,
          // (a post without a video has no "video" key here, so earlier cached answers still match)
          input: { ...input, images: input.images.map((i) => ({ alt: i.alt_text, ocr: i.analysis?.ocr_text ?? "" })), video: input.video ? input.video.transcript.map((s) => s.text) : undefined },
          code: code.map((f) => f.id),
        }),
      )
      .digest("hex");
    ai = opts.backupOnly ? null : await getCache<AiResponse>(cacheKey).catch(() => null);
    const allowance = ai || opts.backupOnly ? "ok" : aiAllowance(opts.clientId, { sharedKey: usingSharedAiKey() });
    // the shared Gemini budget is used up this minute: the backup AI takes the check instead
    const viaBackup = !!opts.backupOnly || (allowance === "global" && backupAvailable());
    if (ai) {
      aiStatus = "ok";
      model = "cached";
    } else if (allowance === "client") {
      aiStatus = "limited";
      detail = "Several checks in the last minute from this visitor";
    } else if (allowance === "global" && !viaBackup) {
      aiStatus = "busy";
      detail = "Too many AI checks right now";
    } else {
      // personal details and confidential terms never leave the server: the AI sees placeholders
      const redactor = createRedactor(settings.confidential_terms);
      const aiInput: PostInput = {
        ...input,
        caption: redactor.redact(input.caption),
        images: input.images.map((img) => ({
          ...img,
          alt_text: redactor.redact(img.alt_text),
          analysis: img.analysis && { ...img.analysis, ocr_text: redactor.redact(img.analysis.ocr_text) },
        })),
        video: input.video && { ...input.video, transcript: input.video.transcript.map((s) => ({ ...s, text: redactor.redact(s.text) })) },
      };
      const aiCode = code.map((f) => ({ ...f, quotes: f.quotes.map((q) => redactor.redact(q)) }));
      redacted = redactor.map.size;
      const parts: AiPart[] = [{ text: buildUserPrompt({ brandName: ctx.brand.name, input: aiInput, rules: ctx.rules, facts: ctx.facts, codeFindings: aiCode, today }) }];
      for (const [i, img] of input.images.entries()) {
        if (img.alt_text.trim() || typeof img.t === "number") continue; // the AI only needs to see images that need alt text (never video frames)
        const part = await imagePart(img.src, opts.origin);
        if (part) parts.push({ text: `Image ${i + 1}:` }, part);
      }
      const started = Date.now();
      let res = viaBackup ? await callBackupOnly(SYSTEM_PROMPT, parts, opts.backupOnly ? 35000 : 45000, opts.backupOnly ? opts.backupModel : undefined) : await callGemini(SYSTEM_PROMPT, parts);
      const read = (text: string) => restore(aiResponseSchema.parse(parseJson(text)), redactor.map);
      if (res.ok) {
        try {
          ai = read(res.text);
        } catch (e) {
          detail = `AI reply didn't match the expected format: ${String(e).slice(0, 120)}`;
          // a garbled answer gets one more try from the other AI, if there is time left
          if (!viaBackup && res.model !== BACKUP_MODEL && backupAvailable() && Date.now() - started < 20000) {
            const again = await callBackupOnly(SYSTEM_PROMPT, parts, 30000);
            if (again.ok) {
              try {
                ai = read(again.text);
                res = again;
              } catch {
                /* still not readable: fast checks only */
              }
            }
          }
        }
        if (ai) {
          aiStatus = "ok";
          model = res.ok ? res.model : null;
          detail = undefined;
          // only Gemini's answers are cached: a backup answer is handled with more care (below) and shouldn't come back as Gemini's
          if (!opts.backupOnly && model !== BACKUP_MODEL) await setCache(cacheKey, ai).catch(() => undefined);
        } else aiStatus = "error";
      } else {
        aiStatus = res.status;
        detail = res.detail;
      }
    }
  }

  // 3. proof check: only AI findings with a real rule, quote and fact survive
  let proof = ai ? proofCheck(ai, code, input, rules, ctx.facts) : { findings: code, ask_human: [], dropped: 0 };
  // the backup AI is a smaller model: its own findings are shown for a person to decide, not counted as problems
  if (model === BACKUP_MODEL) {
    const fromBackup = proof.findings.filter((f) => f.source === "ai");
    proof = {
      ...proof,
      findings: proof.findings.filter((f) => f.source !== "ai"),
      ask_human: [...proof.ask_human, ...fromBackup.map((f) => ({ quote: f.quotes[0] ?? "", location: f.location, note: `${f.rule_id}: ${f.message} Found by the backup AI, so a person decides.` }))],
    };
  }
  const findings = assignIds(proof.findings.map(spokenFix));
  const { score, band } = brandScore(findings);

  return {
    score,
    band,
    findings,
    ask_human: proof.ask_human,
    goal: ai?.goal && (ai.goal.message || ai.goal.post_type) ? ai.goal : null,
    suggested_caption: (() => {
      const text = unquote(ai?.suggested_caption, input.caption);
      if (!text) return null;
      const known = [input.caption, ctx.brand.name, ...settings.products, ...ctx.facts.map((f) => `${f.product} ${f.fact}`), ...input.images.map((i) => i.analysis?.ocr_text ?? ""), ...(input.video?.transcript ?? []).map((t) => t.text)];
      return rewriteKeepsNumbers(text, known) ? text : null;
    })(),
    ai_status: aiStatus,
    model,
    rulebook_version: ctx.brand.rulebook_version,
    dropped: proof.dropped,
    redacted,
    ai_detail: detail,
  };
}
