"use client";

import { useEffect, useState } from "react";
import { useHashScroll } from "@/lib/client/use-hash-scroll";
import { api, type BrandData } from "@/lib/client/api";
import type { Category, Rule, Severity } from "@/lib/types";
import { Button, ErrorNote, SeverityTag, PageSkeleton } from "./ui";
import { useRole } from "./role-provider";
import { RuleImport } from "./rule-import";
import { useToast } from "./toast";

const CATEGORY_LABEL: Record<Category, string> = { tone: "Tone", words: "Words and names", claims: "Claims", visuals: "Visuals", readability: "Readability" };
const CHECK_LABEL: Record<Rule["check_type"], string> = { code: "Fast check", ai: "AI check", "code+ai": "Fast check + AI" };

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function RuleEditor({ rule, onSave, onCancel }: { rule: Partial<Rule>; onSave: (r: Partial<Rule>) => Promise<void>; onCancel: () => void }) {
  const [r, setR] = useState(rule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof Rule, label: string, rows = 1) => (
    <label className="block text-xs text-ink-soft">
      {label}
      {rows > 1 ? (
        <textarea rows={rows} value={String(r[k] ?? "")} onChange={(e) => setR({ ...r, [k]: e.target.value })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-sm text-ink" />
      ) : (
        <input value={String(r[k] ?? "")} onChange={(e) => setR({ ...r, [k]: e.target.value })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-sm text-ink" />
      )}
    </label>
  );
  return (
    <form
      className="space-y-2 rounded-md border border-line bg-paper p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave(r);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        {!rule.id && (
          <label className="block text-xs text-ink-soft">
            Category
            <select value={r.category ?? "tone"} onChange={(e) => setR({ ...r, category: e.target.value as Category })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-sm text-ink">
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs text-ink-soft">
          Severity
          <select value={r.severity ?? "medium"} onChange={(e) => setR({ ...r, severity: e.target.value as Severity })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-sm text-ink">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        {field("scope", "Where it applies")}
      </div>
      {field("rule", "Rule (one sentence)")}
      {field("guideline", "Guideline text", 3)}
      <div className="grid gap-2 sm:grid-cols-2">
        {field("good", "Do (example)")}
        {field("bad", "Don't (example)")}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" type="submit" disabled={busy}>
          {rule.id ? "Save rule" : "Add rule"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RulebookView() {
  const { role, name } = useRole();
  const [data, setData] = useState<BrandData | null>(null);
  useHashScroll(!!data);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [importing, setImporting] = useState(false);
  const toast = useToast();

  const reload = () => api.brand().then(setData).catch((e) => setError(String(e.message ?? e)));
  useEffect(() => {
    let live = true;
    api
      .brand()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(String(e.message ?? e)));
    return () => {
      live = false;
    };
  }, []);

  const isManager = role === "brand_manager";
  const live = (data?.rules ?? []).filter((r) => r.status !== "rejected");
  const rejected = (data?.rules ?? []).length - live.length;
  // drafts first so imported rules are easy to review
  const rules = live.filter((r) => filter === "all" || r.category === filter).sort((a, b) => Number(b.status === "draft") - Number(a.status === "draft"));
  const drafts = live.filter((r) => r.status === "draft");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Rulebook</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            {data?.brand.name ?? "The brand"}&apos;s rules
            {data?.brand.settings.guidelines_pdf && (
              <>
                , built from the{" "}
                <a href={data.brand.settings.guidelines_pdf} target="_blank" className="underline">
                  guideline PDF
                </a>
              </>
            )}. Every finding cites one of these IDs. {data && `Rulebook version ${data.brand.rulebook_version}; ${live.length - drafts.length} approved rules.`}
          </p>
        </div>
        {isManager ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setImporting(true)}>Import from PDF</Button>
            <Button variant="primary" onClick={() => setEditing("new")}>
              Add a rule
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Switch to Brand manager to edit rules.</p>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {importing && isManager && <RuleImport role={role} actor={name} sample={data?.brand.settings.import_sample} onDone={async () => { await reload(); }} onClose={() => setImporting(false)} />}
      {editing === "new" && (
        <RuleEditor
          rule={{ category: "tone", severity: "medium", scope: "all" }}
          onCancel={() => setEditing(null)}
          onSave={async (r) => {
            await send("/api/rules", "POST", { role, actor: name, rule: { ...r, status: "approved" } });
            setEditing(null);
            await reload();
          }}
        />
      )}

      {drafts.length > 0 && (
        <p className="rounded-md bg-med-bg px-3 py-2 text-sm text-med">
          {drafts.length} draft rule{drafts.length > 1 ? "s" : ""} waiting for approval. Drafts are not used in checks until the brand manager approves them.
          {!isManager && " Switch to Brand manager to approve or reject them."}
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", ...Object.keys(CATEGORY_LABEL)] as (Category | "all")[]).map((c) => (
          <button key={c} onClick={() => setFilter(c)} aria-pressed={filter === c} className={`rounded-full border px-3 py-1 ${filter === c ? "border-ink bg-ink text-white" : "border-line-strong bg-surface"}`}>
            {c === "all" ? "All" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {!data && !error && <PageSkeleton rows={6} />}
      <ul className="space-y-3">
        {rules.map((r) => (
          <li key={r.id} id={r.id} className={`target-flash scroll-mt-24 rounded-lg border bg-surface p-4 ${r.status === "draft" ? "border-med/40" : "border-line"}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-sm font-semibold">{r.id}</span>
              <SeverityTag severity={r.severity} />
              <span className="text-ink-soft">{CATEGORY_LABEL[r.category]}</span>
              <span className="text-ink-faint">{CHECK_LABEL[r.check_type]}</span>
              <span className="text-ink-faint">Applies to: {r.scope}</span>
              <span className="text-ink-faint">v{r.version}</span>
              {r.status === "draft" && <span className="rounded bg-med-bg px-1.5 py-0.5 font-semibold text-med">Draft</span>}
              {isManager && editing !== r.id && (
                <span className="ml-auto flex gap-1">
                  {r.status === "draft" && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={async () => {
                        await send(`/api/rules/${r.id}`, "PATCH", { role, actor: name, changes: { status: "approved" } });
                        await reload();
                        toast(`${r.id} approved. It's used in the next check.`);
                      }}
                    >
                      Approve
                    </Button>
                  )}
                  {r.status === "draft" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await send(`/api/rules/${r.id}`, "PATCH", { role, actor: name, changes: { status: "rejected" } });
                        await reload();
                        toast(`${r.id} rejected and hidden.`, "info");
                      }}
                    >
                      Reject
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>
                    Edit
                  </Button>
                </span>
              )}
            </div>
            {editing === r.id ? (
              <div className="mt-3">
                <RuleEditor
                  rule={r}
                  onCancel={() => setEditing(null)}
                  onSave={async (x) => {
                    const { severity, scope, rule, guideline, good, bad } = x;
                    await send(`/api/rules/${r.id}`, "PATCH", { role, actor: name, changes: { severity, scope, rule, guideline, good, bad } });
                    setEditing(null);
                    await reload();
                  }}
                />
              </div>
            ) : (
              <>
                <p className="mt-2 font-medium">{r.rule}</p>
                {r.source && <p className="mt-1 text-xs text-ink-faint">Drafted by AI from {r.source}</p>}
                {r.guideline && <p className="mt-1 text-sm text-ink-soft">{r.guideline}</p>}
                {(r.good || r.bad) && (
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    {r.good && <p className="rounded bg-pass-bg px-2 py-1"><span className="font-semibold text-pass">Do:</span> {r.good}</p>}
                    {r.bad && <p className="rounded bg-high-bg px-2 py-1"><span className="font-semibold text-high">Don&apos;t:</span> {r.bad}</p>}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {rejected > 0 && <p className="text-xs text-ink-faint">{rejected} rejected draft{rejected > 1 ? "s" : ""} hidden. Rejected drafts are kept for the record but never used.</p>}
    </div>
  );
}
