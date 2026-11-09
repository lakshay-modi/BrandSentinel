"use client";

import { useState } from "react";
import type { Fact, Finding } from "@/lib/types";
import type { DecisionRow } from "@/lib/client/api";
import { canApply, describeFix } from "@/lib/fixes";
import { Button, IdLink, SEVERITY_STYLE, SeverityTag } from "./ui";

const SOURCE_LABEL: Record<Finding["source"], string> = {
  code: "Found by fast check",
  ai: "Found by AI, verified by proof check",
  "code+ai": "Found by fast check and AI",
};

export function FindingCard({
  f,
  n,
  facts,
  decision,
  canAct,
  onAccept,
  onEdit,
  onDisagree,
  highlighted,
  stale,
  active,
  onHover,
}: {
  f: Finding;
  n: number;
  facts: Map<string, Fact>;
  decision?: DecisionRow;
  canAct: boolean;
  onAccept: () => Promise<void>;
  /** `where`: for something missing from the caption, add the text at the start or the end */
  onEdit: (text: string, where?: "start" | "end") => Promise<void>;
  onDisagree: (reason: string) => Promise<void>;
  highlighted?: boolean;
  /** the text this fix changes is already gone (another fix or an edit changed it) */
  stale?: boolean;
  /** pointed at from the post's marks, by hover or keyboard */
  active?: boolean;
  onHover?: (on: boolean) => void;
}) {
  const [mode, setMode] = useState<"none" | "edit" | "add" | "disagree">("none");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const s = SEVERITY_STYLE[f.severity];
  const inCaption = f.location === "caption";
  // the demo brand's alt-text rule (an imported brand's READ-02 can mean something else)
  const isAlt = f.fix.kind === "alt_text" || (f.rule_id === "READ-02" && !inCaption && f.source !== "ai");
  // something missing from the caption (for example "#ad"), with no ready-made fix: the creator writes what to add
  const missing = inCaption && f.quotes.length === 0 && !canApply(f.fix);
  // text inside an image can't be changed here, so only caption fixes and alt text are one-click
  const acceptable = (inCaption && canApply(f.fix) && !stale) || f.fix.kind === "alt_text";
  const editable = (inCaption && f.quotes.length > 0 && !stale) || isAlt;
  const editDefault = f.fix.kind === "replace" ? f.fix.pairs[0].to : f.fix.kind === "alt_text" ? f.fix.text : f.quotes[0] ?? "";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setMode("none");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      id={`finding-${f.id}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`relative scroll-mt-24 border-b border-line transition-colors last:border-0 ${highlighted ? "flash" : ""} ${active ? "bg-paper/70" : ""}`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 transition-opacity ${s.dot} ${active ? "opacity-100" : "opacity-0"}`} />
      <div className="flex gap-3.5 px-5 py-4">
        <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums text-white ${s.dot}`} aria-hidden="true">
          {n}
        </span>
        <div className={`min-w-0 flex-1 space-y-2.5 ${decision ? "opacity-70" : ""}`}>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
            <SeverityTag severity={f.severity} />
            <IdLink kind="rule" id={f.rule_id} />
            <span className="text-ink-faint">{f.location === "caption" ? "in the caption" : `in ${f.location}`}</span>
          </div>
          <p className="text-[15px] leading-relaxed">{f.message}</p>
          <div className="space-y-1 border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Rule:</span> {f.evidence}
            </p>
            {f.fact_ids.map((id) => {
              const fact = facts.get(id);
              return (
                <p key={id}>
                  <span className="font-semibold text-ink">Fact</span> <IdLink kind="fact" id={id} />: {fact ? `${fact.fact} (${fact.source})` : "not found"}
                </p>
              );
            })}
            <p className="text-ink-faint">{SOURCE_LABEL[f.source]}</p>
          </div>
          <p className="text-[14px] leading-relaxed">
            <span className="font-semibold">{acceptable ? "Suggested fix: " : "How to fix: "}</span>
            <span className="text-ink-soft">{describeFix(f.fix)}</span>
            {!inCaption && !isAlt && <span className="block text-[13px] text-ink-faint">This is inside the image, so change the image and check again.</span>}
            {stale && <span className="block text-[13px] text-ink-faint">This text has already changed in your edits. Re-check to confirm it&apos;s fixed.</span>}
          </p>

          {decision ? (
            <p className={`text-[14px] font-semibold ${decision.action === "disagree" ? "text-med" : "text-pass"}`}>
              {decision.action === "accept" && `Fix accepted by ${decision.actor}`}
              {decision.action === "edit" && `Edited by ${decision.actor}`}
              {decision.action === "disagree" && `${decision.actor} rejected this: “${decision.reason}”`}
            </p>
          ) : canAct ? (
            <>
              {mode === "none" && (
                <div className="flex flex-wrap gap-2">
                  {acceptable && (
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => run(onAccept)}>
                      Accept fix
                    </Button>
                  )}
                  {editable && (
                    <Button size="sm" disabled={busy} onClick={() => { setText(isAlt && f.fix.kind !== "alt_text" ? "" : editDefault); setMode("edit"); }}>
                      {isAlt && f.fix.kind !== "alt_text" ? "Write alt text" : "Edit"}
                    </Button>
                  )}
                  {missing && (
                    <Button size="sm" disabled={busy} onClick={() => { setText(""); setMode("add"); }}>
                      Add text
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy} title="Disagree with this problem and say why" onClick={() => { setText(""); setMode("disagree"); }}>
                    Reject
                  </Button>
                </div>
              )}
              {mode !== "none" && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const where = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "start" ? "start" : "end";
                    run(() => (mode === "edit" ? onEdit(text) : mode === "add" ? onEdit(text, where) : onDisagree(text)));
                  }}
                >
                  <label className="block text-[13px] text-ink-soft">
                    {mode === "edit" ? (isAlt ? "Alt text for the image" : `Replace “${f.quotes[0]}” with`) : mode === "add" ? "Text to add to the caption" : "Why are you rejecting this? (the reviewer will see your reason)"}
                    <input
                      autoFocus
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-line-strong px-2.5 py-1.5 text-[14px] text-ink"
                      required={mode === "disagree" || mode === "add"}
                      minLength={mode === "disagree" ? 3 : mode === "add" ? 1 : 0}
                    />
                  </label>
                  <div className="flex gap-2">
                    {mode === "add" ? (
                      <>
                        <Button size="sm" variant="primary" type="submit" value="start" disabled={busy}>
                          Add at the start
                        </Button>
                        <Button size="sm" type="submit" value="end" disabled={busy}>
                          Add at the end
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="primary" type="submit" disabled={busy}>
                        {mode === "edit" ? "Apply edit" : "Send rejection"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" type="button" onClick={() => setMode("none")}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
