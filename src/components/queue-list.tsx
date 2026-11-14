"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteLater, usePosts, waitingFor, type QueueRow as Row } from "@/lib/client/use-posts";
import { can } from "@/lib/roles";
import { CHANNEL_LABEL, ErrorNote, StatusTag, timeAgo, PageSkeleton } from "./ui";
import { DemoReset } from "./demo-reset";
import { useToast } from "./toast";
import { ROLE_LABEL, useRole } from "./role-provider";
import { RoleNote } from "./role-note";


const BAND_CLS: Record<string, string> = { green: "text-pass", amber: "text-med", red: "text-high" };

export function QueueList() {
  const { role, name, fixed } = useRole();
  const { rows, error } = usePosts(0);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const toast = useToast();
  const deletable = (p: Row) => can(role, "check_posts") && (p.status === "draft" || p.status === "changes_requested");

  const remove = (p: Row) => {
    const undo = deleteLater(p, { role, actor: name }, (m) => toast(m, "error"));
    toast(`“${p.title || "Untitled post"}” deleted.`, "info", { action: { label: "Undo", onClick: undo } });
  };

  const mine = (p: Row) => waitingFor(role, p);
  const mineCount = (rows ?? []).filter(mine).length;
  const shown = (rows ?? []).filter((p) => tab === "all" || mine(p));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Review queue</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
            {role === "creator"
              ? "Posts you can still fix and submit."
              : `Posts waiting for the ${ROLE_LABEL[role]}. Claims, serious problems and disputes go to the expert reviewer first.`}
          </p>
        </div>
        <div role="tablist" className="flex rounded-lg border border-line-strong bg-paper p-0.5 text-[13px]">
          {(["mine", "all"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1 font-medium ${tab === t ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}>
              {t === "mine" ? (role === "creator" ? "To fix" : "Waiting for me") : "All posts"}
              <span className={`ml-1.5 tabular-nums ${tab === t ? "text-white/70" : "text-ink-faint"}`}>{t === "mine" ? mineCount : (rows ?? []).length}</span>
            </button>
          ))}
        </div>
      </div>

      <RoleNote
        notes={{
          creator: "Your drafts and posts sent back to you. Open one to fix its problems, re-check it and submit it.",
          expert: "Posts with health or number claims, serious problems or a creator's disagreement come to you first. Approve the claims or send the post back.",
          brand_manager: "Posts come to you last. Give final approval, or send the post back to the creator with a comment.",
        }}
      />

      {error && !rows && <ErrorNote>{error}</ErrorNote>}
      {!rows && !error && <PageSkeleton rows={4} />}
      {rows && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface p-10 text-center text-[14px]">
          <p className="text-[16px] font-semibold">Nothing waiting for you</p>
          <p className="mt-1 text-ink-soft">
            {role === "creator" ? "Check a new post to start." : `When a creator submits a post that needs you, it appears here.${fixed ? "" : " Switch to Creator to submit one."}`}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/" className="rounded-lg bg-ink px-4 py-2 font-semibold text-white">
              Check a post
            </Link>
            {tab === "mine" && (
              <button type="button" onClick={() => setTab("all")} className="rounded-lg border border-line-strong bg-surface px-4 py-2 font-semibold">
                See all posts
              </button>
            )}
          </div>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {shown.map((p) => (
            <li key={p.id} className="group relative">
              <Link
                href={`/posts/${p.id}`}
                className={`grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-paper sm:grid-cols-[3rem_minmax(0,1fr)_auto] ${deletable(p) ? "pr-14" : ""}`}
              >
                <span className={`text-[26px] font-bold leading-none tracking-tight tabular-nums ${p.latest ? BAND_CLS[p.latest.band] ?? "" : "text-ink-faint"}`} aria-label={p.latest ? `Score ${p.latest.score}` : "Not checked yet"}>
                  {p.latest ? p.latest.score : "–"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{p.title || "Untitled post"}</p>
                  <p className="text-[13px] text-ink-soft">
                    {CHANNEL_LABEL[p.channel] ?? p.channel}, {p.post_type}. By {p.created_by}, {timeAgo(p.updated_at)}
                    {p.status === "in_review" && p.assigned_role ? `. Waiting for ${ROLE_LABEL[p.assigned_role]}` : ""}
                  </p>
                </div>
                <div className="col-start-2 flex items-center gap-3 sm:col-start-auto">
                  {p.latest && (
                    <span className="text-[13px] tabular-nums text-ink-soft">
                      {p.latest.problems === 0 ? "No problems" : `${p.latest.problems} problem${p.latest.problems === 1 ? "" : "s"}`}
                    </span>
                  )}
                  <StatusTag status={p.status} />
                </div>
              </Link>
              {deletable(p) && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label={`Delete draft “${p.title || "Untitled post"}”`}
                  title="Delete this draft"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-faint transition-colors hover:bg-high-bg hover:text-high focus-visible:text-high"
                >
                  <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <DemoReset />
    </div>
  );
}
