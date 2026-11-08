"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Insights } from "@/lib/insights";
import { ErrorNote, Panel, SeverityTag } from "./ui";

const CATEGORY_LABEL: Record<string, string> = { tone: "Tone", words: "Words and names", claims: "Claims", visuals: "Visuals", readability: "Readability" };

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

export function InsightsView() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/insights")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load insights");
        if (live) setData(d);
      })
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <p className="text-sm text-ink-soft">Loading…</p>;
  const t = data.totals;
  const maxCount = Math.max(1, ...data.top_rules.map((r) => r.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Insights</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">What goes wrong most often, and which rules people keep disagreeing with. Built from every check and every human decision in this workspace. The demo starts with a few posts checked by sample users (Priya, Rohan and Sana) so this page has data; your checks are added live.</p>
      </div>

      {t.checks === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm">
          <p className="font-medium">No checks yet.</p>
          <p className="mt-1 text-ink-soft">Insights fill in as posts are checked and reviewed.</p>
          <Link href="/" className="mt-3 inline-block rounded-md bg-ink px-3 py-2 text-white">
            Check a post
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Posts checked" value={String(t.posts)} note={`${t.checks} checks in total`} />
            <Stat label="Average score" value={t.avg_first === null ? "–" : `${t.avg_first} → ${t.avg_latest}`} note="First check → latest check" />
            <Stat label="Fixes accepted" value={t.acceptance === null ? "–" : `${t.acceptance}%`} note="Of all decisions on findings" />
            <Stat label="Approved" value={String(t.approved)} note={`${t.in_review} waiting for review`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Most common problems (first check)">
              {data.top_rules.length === 0 ? (
                <p className="text-sm text-ink-faint">No problems found so far.</p>
              ) : (
                <ul className="space-y-3">
                  {data.top_rules.map((r) => (
                    <li key={r.rule_id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{r.rule_id}</span>
                        <SeverityTag severity={r.severity} />
                        <span className="ml-auto tabular-nums text-ink-soft">
                          {r.count} time{r.count > 1 ? "s" : ""}, {r.posts} post{r.posts > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-ink-soft">{r.rule}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-paper">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${(r.count / maxCount) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.by_category.length > 0 && (
                <p className="mt-4 text-xs text-ink-soft">
                  By area: {data.by_category.map((c) => `${CATEGORY_LABEL[c.category] ?? c.category} ${c.count}`).join(", ")}.
                </p>
              )}
            </Panel>

            <Panel title="Rules people disagree with">
              {data.unclear.length === 0 ? (
                <p className="text-sm text-ink-faint">No disagreements yet. When creators disagree with a finding, it shows up here.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {data.unclear.map((u) => (
                    <li key={u.rule_id} className={`rounded-md p-3 ${u.status === "unclear" ? "border border-med/40 bg-med-bg" : "bg-paper"}`}>
                      <p>
                        <span className="font-mono font-semibold">{u.rule_id}</span>{" "}
                        {u.status === "unclear" ? <strong className="text-med">Possibly unclear rule</strong> : <span className="text-ink-soft">Watching</span>}
                      </p>
                      <p className="text-ink-soft">{u.rule}</p>
                      <p className="mt-1">
                        {u.disagreements} disagreement{u.disagreements > 1 ? "s" : ""} from {u.people} {u.people > 1 ? "people" : "person"}.
                        {u.status === "unclear" && " Consider rewording it or narrowing where it applies in the Rulebook."}
                      </p>
                      {u.reasons.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-ink-soft">
                          {u.reasons.map((r, i) => (
                            <li key={i}>“{r}”</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink-faint">A rule is flagged as possibly unclear after 3 or more disagreements from 2 or more people.</p>
            </Panel>

            <Panel title="Possible gaps in the guidelines">
              {data.gaps.length === 0 ? (
                <p className="text-sm text-ink-faint">Nothing yet. When the AI spots something no rule covers, it&apos;s listed here instead of being flagged.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.gaps.map((g, i) => (
                    <li key={i}>
                      {g.quote && <span className="font-serif">“{g.quote}”</span>} <span className="text-ink-soft">{g.note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Facts expired or ending within 30 days">
              {data.facts_expiring.length === 0 ? (
                <p className="text-sm text-ink-faint">All facts are valid for at least 30 more days.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.facts_expiring.map((f) => (
                    <li key={f.id}>
                      <span className="font-mono font-semibold">{f.id}</span> <span className={f.expired ? "font-semibold text-high" : "text-med"}>{f.expired ? `Expired ${f.valid_until}` : `Ends ${f.valid_until}`}</span>
                      <p className="text-ink-soft">{f.fact}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/facts" className="mt-3 inline-block text-sm underline">
                Open the Fact Bank
              </Link>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
