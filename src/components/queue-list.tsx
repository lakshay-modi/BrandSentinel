"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type PostRow } from "@/lib/client/api";
import { CHANNEL_LABEL, ErrorNote, StatusTag, timeAgo, PageSkeleton } from "./ui";
import { ROLE_LABEL, useRole } from "./role-provider";

type Row = PostRow & { latest: { score: number; band: string; problems: number } | null };

const BAND_CLS: Record<string, string> = { green: "text-pass", amber: "text-med", red: "text-high" };

export function QueueList() {
  const { role } = useRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "all">("mine");

  useEffect(() => {
    api.posts().then((r) => setRows(r.posts)).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const mine = (p: Row) =>
    role === "creator" ? p.status === "draft" || p.status === "changes_requested" : p.status === "in_review" && p.assigned_role === role;
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
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!rows && !error && <PageSkeleton rows={4} />}
      {rows && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface p-10 text-center text-[14px]">
          <p className="text-[16px] font-semibold">Nothing waiting for you</p>
          <p className="mt-1 text-ink-soft">
            {role === "creator" ? "Check a new post to start." : "When a creator submits a post that needs you, it appears here. Switch to Creator to submit one."}
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
            <li key={p.id}>
              <Link href={`/posts/${p.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4 hover:bg-paper">
                {p.latest && (
                  <span className={`w-12 text-[26px] font-bold leading-none tracking-tight tabular-nums ${BAND_CLS[p.latest.band] ?? ""}`} aria-label={`Score ${p.latest.score}`}>
                    {p.latest.score}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{p.title || "Untitled post"}</p>
                  <p className="text-[13px] text-ink-soft">
                    {CHANNEL_LABEL[p.channel] ?? p.channel}, {p.post_type}. By {p.created_by}, {timeAgo(p.updated_at)}
                    {p.status === "in_review" && p.assigned_role ? `. Waiting for ${ROLE_LABEL[p.assigned_role]}` : ""}
                  </p>
                </div>
                {p.latest && (
                  <p className="text-[13px] tabular-nums text-ink-soft">
                    {p.latest.problems === 0 ? "No problems" : `${p.latest.problems} problem${p.latest.problems === 1 ? "" : "s"}`}
                  </p>
                )}
                <StatusTag status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
