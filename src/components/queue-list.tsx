"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type PostRow } from "@/lib/client/api";
import { CHANNEL_LABEL, ErrorNote, StatusTag, timeAgo } from "./ui";
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
          <h1 className="text-xl font-semibold">Review queue</h1>
          <p className="text-sm text-ink-soft">
            {role === "creator"
              ? "Posts you can still fix and submit."
              : `Posts waiting for the ${ROLE_LABEL[role]}. Claims, serious problems and disputes go to the expert reviewer first.`}
          </p>
        </div>
        <div role="tablist" className="flex rounded-md border border-line-strong bg-surface p-0.5 text-sm">
          {(["mine", "all"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded px-3 py-1 ${tab === t ? "bg-ink text-white" : "text-ink-soft"}`}>
              {t === "mine" ? (role === "creator" ? "To fix" : "Waiting for me") : "All posts"}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!rows && !error && <p className="text-sm text-ink-soft">Loading…</p>}
      {rows && shown.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm">
          <p className="font-medium">Nothing here right now.</p>
          <p className="mt-1 text-ink-soft">
            {role === "creator" ? "Check a new post to start." : "When a creator submits a post that needs you, it appears here. Switch to Creator to submit one."}
          </p>
          <Link href="/" className="mt-3 inline-block rounded-md bg-ink px-3 py-2 text-white">
            Check a post
          </Link>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title || "Untitled post"}</p>
                  <p className="text-xs text-ink-soft">
                    {CHANNEL_LABEL[p.channel] ?? p.channel}, {p.post_type}. By {p.created_by}, {timeAgo(p.updated_at)}
                    {p.status === "in_review" && p.assigned_role ? `. Waiting for ${ROLE_LABEL[p.assigned_role]}` : ""}
                  </p>
                </div>
                {p.latest && (
                  <p className="text-sm tabular-nums">
                    <span className={`font-semibold ${BAND_CLS[p.latest.band] ?? ""}`}>{p.latest.score}</span>
                    <span className="text-ink-faint">/100, {p.latest.problems} problem{p.latest.problems === 1 ? "" : "s"}</span>
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
