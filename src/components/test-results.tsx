"use client";

import { useMemo } from "react";
import expected from "../../demo/expected_findings.json";
import { demoBrand, demoFacts, demoRules, samplePosts } from "@/lib/demo/load-demo";
import { runCodeChecks } from "@/lib/checks/code-checks";
import { runVisualChecks } from "@/lib/checks/visual-checks";
import { assignIds, brandScore } from "@/lib/review/score";
import type { Finding } from "@/lib/types";
import { Panel, SeverityTag } from "./ui";

// The answer key was written on this date; offers and fact end dates are judged as of this day.
const KEY_DATE = "2026-11-08";
const REPO = "https://github.com/lakshay-modi/BrandSentinel/blob/main";

type Key = { post: string; title: string; expected_score: number; expected_findings: { rule: string; where: string; quote: string }[]; should_not_flag: string[] };

interface Row {
  id: string;
  title: string;
  expectedScore: number;
  score: number;
  planted: number;
  caught: number;
  missed: Key["expected_findings"];
  extra: Finding[];
  found: Finding[];
}

function runAll(): Row[] {
  const rules = new Map(demoRules.map((r) => [r.id, r]));
  const posts = samplePosts(true);
  return (expected as Key[]).map((k) => {
    const post = posts.find((p) => p.id === k.post)!;
    const found = assignIds([...runCodeChecks({ input: post, rules, facts: demoFacts, brand: demoBrand, today: KEY_DATE }), ...runVisualChecks(post, rules, demoBrand)]);
    const pool = [...found];
    const missed: Key["expected_findings"] = [];
    for (const e of k.expected_findings) {
      const loc = e.where === "image" ? "image 1" : e.where;
      const i = pool.findIndex((f) => f.rule_id === e.rule && f.location === loc);
      if (i >= 0) pool.splice(i, 1);
      else missed.push(e);
    }
    return {
      id: k.post,
      title: k.title,
      expectedScore: k.expected_score,
      score: brandScore(found).score,
      planted: k.expected_findings.length,
      caught: k.expected_findings.length - missed.length,
      missed,
      extra: pool,
      found,
    };
  });
}

/** Runs the real fast checks on the 10 sample posts in your browser and compares them with the answer key. */
export function TestResults() {
  const rows = useMemo(() => runAll(), []);
  const planted = rows.reduce((n, r) => n + r.planted, 0);
  const caught = rows.reduce((n, r) => n + r.caught, 0);
  const extra = rows.reduce((n, r) => n + r.extra.length, 0);
  const scoresMatch = rows.filter((r) => r.score === r.expectedScore).length;

  const tiles = [
    { label: "Planted mistakes caught", value: `${caught} / ${planted}` },
    { label: "Unexpected flags", value: String(extra), note: "flags not in the answer key" },
    { label: "Scores that match", value: `${scoresMatch} / ${rows.length}` },
    { label: "Clean post (P08)", value: rows.find((r) => r.id === "P08")?.found.length === 0 ? "0 flags" : "flagged" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Test results</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          The 10 sample posts contain planted mistakes, each labelled with the rule it breaks in an{" "}
          <a href={`${REPO}/demo/expected_findings.json`} target="_blank" className="underline">
            answer key
          </a>
          . This page runs the real fast checks on them, right now in your browser, and compares the result with the key. Checked as of {KEY_DATE}, the date the key was written, because offers and facts have end dates.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs text-ink-soft">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</p>
            {t.note && <p className="text-xs text-ink-faint">{t.note}</p>}
          </div>
        ))}
      </div>

      <Panel title="What this does and doesn't show">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>The same team wrote the rules and the test posts, so this shows the fast checks work as designed. It doesn&apos;t prove they catch every mistake in real posts.</li>
          <li>Only the fast checks (plain code) run here, so the result is the same every time. The AI layer is for reworded and new cases, and every AI finding still has to pass the proof check.</li>
          <li>Image results use the reference text and contrast measured from each sample image.</li>
        </ul>
      </Panel>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-paper text-left text-xs text-ink-soft">
            <tr>
              <th className="px-3 py-2 font-medium">Post</th>
              <th className="px-3 py-2 font-medium">Caught</th>
              <th className="px-3 py-2 font-medium">Score (expected)</th>
              <th className="px-3 py-2 font-medium">Rules flagged</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ok = r.missed.length === 0 && r.extra.length === 0;
              return (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-ink-faint">{r.id}</span> {r.title}
                    {r.missed.length > 0 && <p className="text-xs text-high">Missed: {r.missed.map((m) => `${m.rule} “${m.quote}”`).join(", ")}</p>}
                    {r.extra.length > 0 && <p className="text-xs text-med">Unexpected: {r.extra.map((f) => `${f.rule_id} ${JSON.stringify(f.quotes[0] ?? "")}`).join(", ")}</p>}
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${ok ? "text-pass" : "text-high"}`}>
                    {r.caught} / {r.planted} {ok ? "✓" : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.score} <span className="text-ink-faint">({r.expectedScore})</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.found.length === 0 && <span className="text-xs text-pass">No problems</span>}
                      {r.found.map((f) => (
                        <span key={f.id} className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-xs">
                          <SeverityTag severity={f.severity} />
                          <span className="font-mono">{f.rule_id}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-faint">
        The same comparison runs as automated tests in the repo (<code>npm test</code>).
      </p>
    </div>
  );
}
