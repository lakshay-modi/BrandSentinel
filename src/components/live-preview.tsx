"use client";

import { useDeferredValue, useMemo } from "react";
import { runCodeChecks } from "@/lib/checks/code-checks";
import { assignIds, brandScore } from "@/lib/review/score";
import type { PostInput } from "@/lib/types";
import { useBrand } from "@/lib/client/use-brand";
import { ProofText } from "./proof-text";
import { ScoreGauge } from "./score-gauge";
import { SEVERITY_STYLE } from "./ui";


/**
 * Runs the same fast checks as the server, in the browser, on every keystroke.
 * Only the caption is checked here: images, the AI and the proof check run when the post is checked.
 */
export function LivePreview({ input }: { input: PostInput }) {
  const brand = useBrand();
  const deferred = useDeferredValue(input);

  // rules with a fast check; a brand whose rules were all imported from a PDF has only AI-checked rules
  const fastRules = useMemo(() => (brand?.rules ?? []).filter((r) => r.status === "approved" && r.check_type.includes("code")).length, [brand]);

  const result = useMemo(() => {
    if (!brand || !deferred.caption.trim()) return null;
    const rules = new Map(brand.rules.filter((r) => r.status === "approved").map((r) => [r.id, r]));
    const findings = assignIds(runCodeChecks({ input: { ...deferred, images: [] }, rules, facts: brand.facts, brand: brand.brand.settings, today: brand.today }));
    return { findings, ...brandScore(findings) };
  }, [brand, deferred]);

  if (!input.caption.trim()) return null;

  if (brand && fastRules === 0) {
    return (
      <p className="mx-5 mt-4 rounded-xl border border-line bg-paper/50 px-4 py-3 text-[13px] text-ink-soft">
        <span className="font-semibold text-ink">No live preview for {brand.brand.name}.</span> Its rules were imported from its guidelines and are checked by the AI, which
        runs when you press Check post.
      </p>
    );
  }

  return (
    <section aria-label="Live preview" className="mx-5 mt-4 rounded-xl border border-line bg-paper/50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-pass opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-pass" />
          </span>
          Live preview
        </p>
        {result && (
          <div className="flex items-center gap-3" aria-live="polite">
            <p className="text-right text-[12px] leading-tight text-ink-faint">
              Score so far
              <span className="block">out of 100</span>
            </p>
            <ScoreGauge score={result.score} band={result.band} size={72} compact />
          </div>
        )}
      </div>
      {!result ? (
        <p className="px-4 py-3 text-[13px] text-ink-faint">Loading the rules…</p>
      ) : (
        <div className="px-4 py-3">
          <ProofText text={deferred.caption} findings={result.findings.map((f, i) => ({ f, ref: i + 1 }))} className="!text-[17px]" />
          {result.findings.length === 0 ? (
            <p className="mt-2 text-[13px] text-pass">The fast checks find no problems in the caption so far.</p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {result.findings.map((f, i) => {
                const s = SEVERITY_STYLE[f.severity];
                return (
                  <li key={f.id} className="flex gap-2 text-[13px] leading-snug">
                    <span className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${s.dot}`}>{i + 1}</span>
                    <span>
                      <span className="font-mono text-[12px] font-medium">{f.rule_id}</span> <span className="text-ink-soft">{f.message}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[12px] text-ink-faint">
            Fast checks on the caption ({fastRules} rules), as you type. Images, the AI check and the proof check run when you press Check post, so the final score can be lower.
          </p>
        </div>
      )}
    </section>
  );
}
