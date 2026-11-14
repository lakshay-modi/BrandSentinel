// The full review pipeline: fast checks → AI checks → proof check → score.
import "server-only";
import { createHash } from "node:crypto";
import type { Finding, PostInput, ReviewResult } from "../types";
import { runCodeChecks } from "../checks/code-checks";
import { runVisualChecks } from "../checks/visual-checks";
import { todayIST } from "../checks/text-utils";
import { aiConfigured, callGemini, parseJson, type AiPart } from "../ai/gemini";
import { aiResponseSchema, buildUserPrompt, SYSTEM_PROMPT, type AiResponse } from "../ai/prompt";
import { proofCheck } from "../ai/proof";
import { createRedactor, restore } from "../ai/redact";
import { assignIds, brandScore } from "./score";
import { getCache, setCache, type BrandContext } from "../db";
import { allowAiCall } from "./rate-limit";

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

export async function runReview(input: PostInput, ctx: BrandContext, opts: { origin: string; clientId: string; /** fast checks only, for checks while typing in other tools */ codeOnly?: boolean }): Promise<ReviewOutput> {
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
    ai = await getCache<AiResponse>(cacheKey).catch(() => null);
    if (ai) {
      aiStatus = "ok";
      model = "cached";
    } else if (!allowAiCall(opts.clientId)) {
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
      const res = await callGemini(SYSTEM_PROMPT, parts);
      if (res.ok) {
        try {
          ai = restore(aiResponseSchema.parse(parseJson(res.text)), redactor.map);
          aiStatus = "ok";
          model = res.model;
          await setCache(cacheKey, ai).catch(() => undefined);
        } catch (e) {
          aiStatus = "error";
          detail = `AI reply didn't match the expected format: ${String(e).slice(0, 120)}`;
        }
      } else {
        aiStatus = res.status;
        detail = res.detail;
      }
    }
  }

  // 3. proof check: only AI findings with a real rule, quote and fact survive
  const proof = ai ? proofCheck(ai, code, input, rules, ctx.facts) : { findings: code, ask_human: [], dropped: 0 };
  const findings = assignIds(proof.findings.map(spokenFix));
  const { score, band } = brandScore(findings);

  return {
    score,
    band,
    findings,
    ask_human: proof.ask_human,
    goal: ai?.goal && (ai.goal.message || ai.goal.post_type) ? ai.goal : null,
    suggested_caption: ai?.suggested_caption?.trim() || null,
    ai_status: aiStatus,
    model,
    rulebook_version: ctx.brand.rulebook_version,
    dropped: proof.dropped,
    redacted,
    ai_detail: detail,
  };
}
