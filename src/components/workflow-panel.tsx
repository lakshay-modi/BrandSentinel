"use client";

import { useState } from "react";
import type { DecisionRow, HistoryRow, PostRow, ReviewRow } from "@/lib/client/api";
import { needsExpert } from "@/lib/review/score";
import type { Role } from "@/lib/types";
import { Button, ErrorNote, Panel, timeAgo } from "./ui";
import { ROLE_LABEL, useRole } from "./role-provider";

export function WorkflowPanel({
  className = "",
  post,
  review,
  decisions,
  role,
  unsaved,
  onAction,
}: {
  className?: string;
  post: PostRow;
  review: ReviewRow | null;
  decisions: DecisionRow[];
  role: Role;
  unsaved: boolean;
  onAction: (action: "submit" | "approve" | "request_changes", comment?: string) => Promise<void>;
}) {
  const { fixed } = useRole();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewDecisions = review ? decisions.filter((d) => d.review_id === review.id) : [];
  const disputes = reviewDecisions.filter((d) => d.action === "disagree");
  const expert = review ? needsExpert(review.findings, new Set(), disputes.length > 0) : false;

  const run = async (action: "submit" | "approve" | "request_changes") => {
    setBusy(true);
    setError(null);
    try {
      await onAction(action, comment || undefined);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { key: "creator", label: "Creator submits", done: post.status !== "draft" && post.status !== "changes_requested" },
    ...(post.needs_expert || (post.status !== "in_review" && post.status !== "approved" && expert)
      ? [{ key: "expert", label: "Expert reviewer", done: post.expert_approved }]
      : []),
    { key: "brand_manager", label: "Brand manager approves", done: post.status === "approved" },
  ];

  return (
    <Panel title="Approval" className={className}>
      <ol className="mb-5 flex items-start" aria-label="Approval steps">
        {steps.map((s, i) => {
          const current = post.status === "in_review" && post.assigned_role === s.key;
          const state = s.done ? "done" : current ? "current" : "todo";
          return (
            <li key={s.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
              {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${steps[i - 1].done ? "bg-pass" : "bg-line"}`} aria-hidden="true" />}
              <span
                className={`relative z-10 flex size-7 items-center justify-center rounded-full text-[12px] font-bold ${
                  state === "done" ? "bg-pass text-white" : state === "current" ? "bg-surface text-low ring-2 ring-low" : "bg-surface text-ink-faint ring-1 ring-line-strong"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={`mt-1.5 px-1 text-[12.5px] leading-tight ${state === "todo" ? "text-ink-faint" : "font-semibold text-ink"}`}>{s.label}</span>
              {current && <span className="text-[12px] text-low">Waiting</span>}
            </li>
          );
        })}
      </ol>

      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}

      {(post.status === "draft" || post.status === "changes_requested") && (
        <div className="space-y-3 text-sm">
          {role === "creator" ? (
            <>
              <p className="text-ink-soft">
                {expert
                  ? `This will go to the expert reviewer first, then the brand manager, because ${disputes.length ? "you disagreed with a finding" : "it still has claim or high-severity problems"}.`
                  : "This will go straight to the brand manager: no open claims or serious problems."}
              </p>
              {unsaved && <p className="text-med">You&apos;ve changed the post since the last check. Re-check it before submitting.</p>}
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Note for the reviewer (optional)" className="w-full rounded-lg border border-line-strong px-2.5 py-2" />
              <Button variant="primary" disabled={busy || unsaved || !review} onClick={() => run("submit")}>
                Submit for review
              </Button>
            </>
          ) : (
            <p className="text-ink-soft">Waiting for the creator to fix and submit this post.{fixed ? "" : " Switch to Creator at the top to act as the creator."}</p>
          )}
        </div>
      )}

      {post.status === "in_review" && post.assigned_role && (
        <div className="space-y-3 text-sm">
          <p>
            Waiting for the <strong>{ROLE_LABEL[post.assigned_role]}</strong>.
          </p>
          {disputes.length > 0 && (
            <div className="rounded-lg border border-med/30 bg-med-bg p-3">
              <p className="font-medium text-med">The creator disagreed with {disputes.length === 1 ? "a finding" : `${disputes.length} findings`}:</p>
              <ul className="mt-1 list-disc pl-5 text-ink">
                {disputes.map((d) => (
                  <li key={d.id}>
                    <span className="font-mono">{d.rule_id}</span>: “{d.reason}” ({d.actor})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {role === post.assigned_role ? (
            <>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Comment (needed when sending it back)" className="w-full rounded-lg border border-line-strong px-2.5 py-2" />
              <div className="flex flex-wrap gap-2">
                <Button variant="success" disabled={busy} onClick={() => run("approve")}>
                  {role === "expert" ? "Approve claims" : "Approve post"}
                </Button>
                <Button variant="danger" disabled={busy || comment.trim().length < 3} onClick={() => run("request_changes")}>
                  Send back for changes
                </Button>
              </div>
            </>
          ) : (
            <p className="text-ink-soft">{fixed ? `Only the ${ROLE_LABEL[post.assigned_role]} can act on it now.` : `Switch to ${ROLE_LABEL[post.assigned_role]} at the top to review it.`}</p>
          )}
        </div>
      )}

      {post.status === "approved" && (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-pass">Approved and ready to publish.</p>
          <Button size="sm" onClick={() => navigator.clipboard?.writeText(post.caption)}>
            Copy final caption
          </Button>
        </div>
      )}
    </Panel>
  );
}

const ACTION_LABEL: Record<string, string> = {
  created: "created the post",
  checked: "checked the post",
  "re-checked": "re-checked the post",
  "accepted fix": "accepted a fix",
  "edited fix": "edited a fix",
  disagreed: "disagreed with a finding",
  "confirmed goal": "confirmed the post's goal",
  submitted: "submitted for review",
  "expert approved": "approved the claims",
  "requested changes": "sent it back for changes",
  approved: "approved the post",
};

export function HistoryList({ history, className = "" }: { history: HistoryRow[]; className?: string }) {
  return (
    <Panel title="History" className={className}>
      {history.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing yet.</p>
      ) : (
        <ol className="space-y-3 text-sm">
          {[...history].reverse().map((h) => {
            const d = h.detail ?? {};
            const extra = [
              d.score !== undefined ? `score ${d.score}` : null,
              d.rule ? `rule ${d.rule}` : null,
              d.sent_to ? `sent to ${d.sent_to}` : null,
              d.why ? String(d.why) : null,
              d.reason ? `“${d.reason}”` : null,
              d.comment ? `“${d.comment}”` : null,
              d.ai === "busy" || d.ai === "error" ? "AI checks skipped" : null,
            ].filter(Boolean);
            return (
              <li key={h.id} className="relative border-l-2 border-line pl-4 before:absolute before:-left-[5px] before:top-1.5 before:size-2 before:rounded-full before:bg-line-strong">
                <p>
                  <strong>{h.actor}</strong> <span className="text-ink-faint">({ROLE_LABEL[h.role] ?? h.role})</span> {ACTION_LABEL[h.action] ?? h.action}
                </p>
                {extra.length > 0 && <p className="text-ink-soft">{extra.join(". ")}</p>}
                <p className="text-xs text-ink-faint">{timeAgo(h.created_at)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
