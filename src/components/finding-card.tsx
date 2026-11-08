"use client";

import { useState } from "react";
import type { Fact, Finding } from "@/lib/types";
import type { DecisionRow } from "@/lib/client/api";
import { canApply, describeFix } from "@/lib/fixes";
import { Button, SEVERITY_STYLE, SeverityTag } from "./ui";

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
}: {
  f: Finding;
  n: number;
  facts: Map<string, Fact>;
  decision?: DecisionRow;
  canAct: boolean;
  onAccept: () => Promise<void>;
  onEdit: (text: string) => Promise<void>;
  onDisagree: (reason: string) => Promise<void>;
  highlighted?: boolean;
  /** the text this fix changes is already gone (another fix or an edit changed it) */
  stale?: boolean;
}) {
  const [mode, setMode] = useState<"none" | "edit" | "disagree">("none");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const s = SEVERITY_STYLE[f.severity];
  const inCaption = f.location === "caption";
  const isAlt = f.rule_id === "READ-02" || f.fix.kind === "alt_text";
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
    <li id={`finding-${f.id}`} className={`rounded-lg border bg-surface ${highlighted ? "flash border-low" : "border-line"} ${decision ? "opacity-80" : ""}`}>
      <div className="flex gap-3 p-4">
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${s.dot}`} aria-hidden="true">
          {n}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <SeverityTag severity={f.severity} />
            <a href={`/rulebook#${f.rule_id}`} className="font-mono font-semibold text-ink hover:underline" title="Open this rule in the Rulebook">
              {f.rule_id}
            </a>
            <span className="text-ink-faint">{f.location === "caption" ? "Caption" : f.location[0].toUpperCase() + f.location.slice(1)}</span>
          </div>
          <p className="text-sm leading-6">{f.message}</p>
          <div className="rounded-md bg-paper px-3 py-2 text-xs leading-5 text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Rule {f.rule_id}:</span> {f.evidence}
            </p>
            {f.fact_ids.map((id) => {
              const fact = facts.get(id);
              return (
                <p key={id} className="mt-1">
                  <a href={`/facts#${id}`} className="font-semibold text-ink hover:underline">Fact {id}:</a> {fact ? `${fact.fact} (${fact.source})` : "not found"}
                </p>
              );
            })}
            <p className="mt-1 text-ink-faint">{SOURCE_LABEL[f.source]}</p>
          </div>
          <p className="text-sm">
            <span className="font-medium">{acceptable ? "Suggested fix: " : "How to fix: "}</span>
            <span className="text-ink-soft">{describeFix(f.fix)}</span>
            {!inCaption && !isAlt && <span className="block text-xs text-ink-faint">This is in the image, so update the image and check again.</span>}
            {stale && <span className="block text-xs text-ink-faint">This text has already changed in your edits. Re-check to confirm it&apos;s fixed.</span>}
          </p>

          {decision ? (
            <p className={`text-sm font-medium ${decision.action === "disagree" ? "text-med" : "text-pass"}`}>
              {decision.action === "accept" && `Fix accepted by ${decision.actor}`}
              {decision.action === "edit" && `Edited by ${decision.actor}`}
              {decision.action === "disagree" && `${decision.actor} disagreed: “${decision.reason}”`}
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
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setText(""); setMode("disagree"); }}>
                    Disagree
                  </Button>
                </div>
              )}
              {mode !== "none" && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => (mode === "edit" ? onEdit(text) : onDisagree(text)));
                  }}
                >
                  <label className="block text-xs text-ink-soft">
                    {mode === "edit" ? (isAlt ? "Alt text for the image" : `Replace “${f.quotes[0]}” with`) : "Why do you disagree? (the reviewer will see this)"}
                    <input
                      autoFocus
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="mt-1 w-full rounded-md border border-line-strong px-2 py-1.5 text-sm text-ink"
                      required={mode === "disagree"}
                      minLength={mode === "disagree" ? 3 : 0}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" type="submit" disabled={busy}>
                      {mode === "edit" ? "Apply edit" : "Send disagreement"}
                    </Button>
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
