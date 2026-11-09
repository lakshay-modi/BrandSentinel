"use client";

import { useMemo, useState } from "react";
import { useHashScroll } from "@/lib/client/use-hash-scroll";
import type { BrandData } from "@/lib/client/api";
import { optimistic, patchBrand, reloadBrand, useBrandState } from "@/lib/client/use-brand";
import { send } from "@/lib/client/send";
import { can } from "@/lib/roles";
import type { Category, GuidelineDoc, Rule, Severity } from "@/lib/types";
import { Button, ConfirmDialog, Count, Dialog, EmptyState, ErrorNote, PageSkeleton, SEVERITY_STYLE, SeverityTag, timeAgo } from "./ui";
import { useRole } from "./role-provider";
import { RoleNote } from "./role-note";
import { RuleImport } from "./rule-import";
import { useToast } from "./toast";

const CATEGORY_LABEL: Record<Category, string> = { tone: "Tone", words: "Words and names", claims: "Claims", visuals: "Visuals", readability: "Readability" };
const CHECK_LABEL: Record<Rule["check_type"], string> = { code: "Fast check", ai: "AI check", "code+ai": "Fast check + AI" };
type StatusFilter = "all" | "draft" | "approved" | "paused";
const MANUAL = "manual";

/* ---------- small pieces ---------- */

function RuleEditor({ rule, onSave, onCancel }: { rule: Partial<Rule>; onSave: (r: Partial<Rule>) => Promise<void>; onCancel: () => void }) {
  const [r, setR] = useState(rule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof Rule, label: string, rows = 1, hint?: string) => (
    <label className="block">
      <span className="field-label">{label}</span>
      {rows > 1 ? (
        <textarea rows={rows} value={String(r[k] ?? "")} onChange={(e) => setR({ ...r, [k]: e.target.value })} className="field mt-1" />
      ) : (
        <input value={String(r[k] ?? "")} onChange={(e) => setR({ ...r, [k]: e.target.value })} className="field mt-1" required={k === "rule"} minLength={k === "rule" ? 5 : undefined} />
      )}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave(r);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {!rule.id && (
          <label className="block">
            <span className="field-label">Category</span>
            <select value={r.category ?? "tone"} onChange={(e) => setR({ ...r, category: e.target.value as Category })} className="field mt-1">
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="field-label">Severity</span>
          <select value={r.severity ?? "medium"} onChange={(e) => setR({ ...r, severity: e.target.value as Severity })} className="field mt-1">
            <option value="high">High: blocks approval</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        {field("scope", "Where it applies", 1)}
      </div>
      {field("rule", "Rule", 1, "One sentence a creator can act on.")}
      {field("guideline", "Guideline text", 3, "The brand's own wording; the AI reads this when it checks.")}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("good", "Do (example)")}
        {field("bad", "Don't (example)")}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          {rule.id ? "Save rule" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}

function docCounts(rules: Rule[], docId: string | null) {
  const mine = rules.filter((r) => (r.document_id ?? null) === docId);
  return {
    approved: mine.filter((r) => r.status === "approved" || r.status === "paused").length,
    drafts: mine.filter((r) => r.status === "draft").length,
    total: mine.filter((r) => r.status !== "rejected").length,
  };
}

function FileIcon({ kind }: { kind: GuidelineDoc["kind"] }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-paper text-[10px] font-bold uppercase tracking-wide text-ink-soft">
      {kind === "pdf" ? "PDF" : kind === "text" ? "TXT" : "Set"}
    </span>
  );
}

/** One rulebook (a guidelines document and the rules drafted from it). */
function DocCard({
  doc,
  counts,
  selected,
  manage,
  onSelect,
  onRename,
  onToggle,
  onReplace,
  onRemove,
}: {
  doc: GuidelineDoc;
  counts: ReturnType<typeof docCounts>;
  selected: boolean;
  manage: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onToggle: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(doc.name);
  const paused = doc.status === "paused";
  return (
    <li
      className={`group relative flex min-w-0 flex-col rounded-xl border bg-surface p-4 transition-shadow ${selected ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:shadow-[var(--shadow-sheet)]"} ${paused ? "bg-paper/60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <FileIcon kind={doc.kind} />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 2) onRename(name.trim());
                setRenaming(false);
              }}
            >
              <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} className="field !py-1 !text-[14px]" aria-label="Rulebook name" />
              <Button size="sm" type="submit" variant="primary">
                Save
              </Button>
            </form>
          ) : (
            <button type="button" onClick={onSelect} className="block w-full text-left">
              <span className="block truncate text-[15px] font-semibold leading-snug after:absolute after:inset-0 after:content-['']" title={doc.name}>
                {doc.name}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-ink-faint" title={doc.file_name ?? undefined}>
                {doc.kind === "seed" ? "Built in" : doc.file_name} · {doc.created_by ? `${doc.created_by}, ` : ""}
                {timeAgo(doc.created_at)}
              </span>
            </button>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${paused ? "bg-line text-ink-soft" : "bg-pass-bg text-pass"}`}>{paused ? "Paused" : "In use"}</span>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 text-[13px] text-ink-soft">
        <span>
          <strong className="text-ink tabular-nums">{counts.approved}</strong> approved
        </span>
        {counts.drafts > 0 && (
          <span className="font-semibold text-med">
            <span className="tabular-nums">{counts.drafts}</span> to review
          </span>
        )}
      </p>
      {manage && !renaming && (
        <div className="relative z-10 mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
          <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle} title={paused ? "Use its rules in checks again" : "Stop using its rules in checks, without deleting them"}>
            {paused ? "Resume" : "Pause"}
          </Button>
          {doc.kind !== "seed" && (
            <Button size="sm" variant="ghost" onClick={onReplace} title="Uploaded the wrong file? Upload the right one">
              Replace file
            </Button>
          )}
          <Button size="sm" variant="ghost" className="!text-high hover:!bg-high-bg" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

/* ---------- the page ---------- */

export function RulebookView() {
  const { role, name } = useRole();
  const { data, error } = useBrandState();
  useHashScroll(!!data);
  const toast = useToast();
  const manage = can(role, "manage_rules");

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState<{ replacing: GuidelineDoc | null } | null>(null);
  const [removing, setRemoving] = useState<GuidelineDoc | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [doc, setDoc] = useState<string>("all");
  const [query, setQuery] = useState("");

  const fail = (m: string) => toast(m, "error");
  const bump = (d: BrandData): BrandData => ({ ...d, brand: { ...d.brand, rulebook_version: d.brand.rulebook_version + 1 } });
  const setRules = (fn: (rules: Rule[]) => Rule[]) => (d: BrandData) => bump({ ...d, rules: fn(d.rules) });
  const isPausedDoc = (id: string | null | undefined) => !!id && data?.documents.some((x) => x.id === id && x.status === "paused");

  const live = useMemo(() => (data?.rules ?? []).filter((r) => r.status !== "rejected"), [data]);
  const rejected = (data?.rules.length ?? 0) - live.length;
  const docs = data?.documents ?? [];
  const manualCount = live.filter((r) => !r.document_id).length;

  const inDoc = live.filter((r) => doc === "all" || (doc === MANUAL ? !r.document_id : r.document_id === doc));
  const statusCount = (s: StatusFilter) => (s === "all" ? inDoc.length : inDoc.filter((r) => r.status === s).length);
  const q = query.trim().toLowerCase();
  const rules = inDoc
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => category === "all" || r.category === category)
    .filter((r) => !q || `${r.id} ${r.rule} ${r.guideline} ${r.scope}`.toLowerCase().includes(q))
    // drafts first so imported rules are easy to review
    .sort((a, b) => Number(b.status === "draft") - Number(a.status === "draft"));
  const visibleDrafts = rules.filter((r) => r.status === "draft");
  const allDrafts = live.filter((r) => r.status === "draft").length;
  const approvedCount = live.filter((r) => r.status === "approved").length;

  /* ---- actions: the screen changes first, the server follows ---- */

  const decide = (r: Rule, next: "approved" | "rejected") => {
    const shown = next === "approved" && isPausedDoc(r.document_id) ? "paused" : next;
    toast(next === "approved" ? `${r.id} approved. It's used in the next check.` : `${r.id} rejected.`, next === "approved" ? "success" : "info");
    void optimistic(
      setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: shown, version: x.version + 1 } : x))),
      () => send(`/api/rules/${r.id}`, "PATCH", { role, actor: name, changes: { status: next } }),
      fail,
    );
  };

  const decideAll = (next: "approved" | "rejected") => {
    const ids = visibleDrafts.map((r) => r.id);
    if (!ids.length) return;
    const paused = new Set(docs.filter((d) => d.status === "paused").map((d) => d.id));
    toast(`${ids.length} draft${ids.length > 1 ? "s" : ""} ${next}.`, next === "approved" ? "success" : "info");
    void optimistic(
      setRules((rs) => rs.map((x) => (ids.includes(x.id) ? { ...x, status: next === "approved" && x.document_id && paused.has(x.document_id) ? "paused" : next } : x))),
      () => send("/api/rules", "PATCH", { role, actor: name, ids, changes: { status: next } }),
      fail,
    );
  };

  const removeRule = (r: Rule) => {
    setDeleting(null);
    toast(`${r.id} deleted.`, "info");
    void optimistic(
      setRules((rs) => rs.filter((x) => x.id !== r.id)),
      () => send(`/api/rules/${r.id}`, "DELETE", { role, actor: name }),
      fail,
    );
  };

  const saveEdit = async (r: Rule, x: Partial<Rule>) => {
    const { severity, scope, rule, guideline, good, bad } = x;
    const changes = { severity, scope, rule, guideline, good, bad };
    setEditing(null);
    toast(`${r.id} saved.`);
    await optimistic(
      setRules((rs) => rs.map((y) => (y.id === r.id ? ({ ...y, ...changes, version: y.version + 1 } as Rule) : y))),
      () => send(`/api/rules/${r.id}`, "PATCH", { role, actor: name, changes }),
      fail,
    );
  };

  const setDocField = (d: GuidelineDoc, changes: Partial<Pick<GuidelineDoc, "name" | "status">>) => {
    const pausing = changes.status === "paused";
    const resuming = changes.status === "active";
    if (changes.status) toast(pausing ? `“${d.name}” paused. Its rules aren't used in checks.` : `“${d.name}” is back in use.`, "info");
    void optimistic(
      (b) => ({
        ...(changes.status ? bump(b) : b),
        documents: b.documents.map((x) => (x.id === d.id ? { ...x, ...changes } : x)),
        rules: b.rules.map((r) =>
          r.document_id !== d.id ? r : pausing && r.status === "approved" ? { ...r, status: "paused" } : resuming && r.status === "paused" ? { ...r, status: "approved" } : r,
        ),
      }),
      () => send(`/api/documents/${d.id}`, "PATCH", { role, actor: name, changes }),
      fail,
    );
  };

  const removeDoc = (d: GuidelineDoc) => {
    setRemoving(null);
    if (doc === d.id) setDoc("all");
    toast(`“${d.name}” and its rules were removed.`, "info");
    void optimistic(
      (b) => bump({ ...b, documents: b.documents.filter((x) => x.id !== d.id), rules: b.rules.filter((r) => r.document_id !== d.id) }),
      () => send(`/api/documents/${d.id}`, "DELETE", { role, actor: name }),
      fail,
    );
  };

  /* ---- render ---- */

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Rulebook</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            {data?.brand.name ?? "The brand"}&apos;s rules, grouped by the guidelines they came from. Every problem a check finds cites one of these IDs.
            {data && (
              <span className="text-ink-faint">
                {" "}
                Version {data.brand.rulebook_version} · {approvedCount} rule{approvedCount === 1 ? "" : "s"} in use.
              </span>
            )}
          </p>
        </div>
        {manage && data && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdding(true)}>Add a rule by hand</Button>
            <Button variant="primary" onClick={() => setImportOpen({ replacing: null })}>
              <span aria-hidden="true" className="text-[17px] leading-none">+</span> Add a rulebook
            </Button>
          </div>
        )}
      </div>

      <RoleNote
        notes={{
          creator: "Read-only for you. These are the rules your posts are checked against; open one from any problem to see why it was flagged.",
          expert: "Read-only for you. Claims are judged against these rules and the Fact Bank, which you keep up to date.",
          brand_manager: "You own this page: add rulebooks from PDFs, approve or reject drafted rules, and pause or replace a rulebook if it's wrong.",
        }}
      />

      {error && !data && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <PageSkeleton rows={5} />}

      {data && (
        <>
          {/* rulebooks */}
          <section aria-labelledby="rulebooks-h" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="rulebooks-h" className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Rulebooks <span className="font-medium normal-case tracking-normal text-ink-faint">· click one to see only its rules</span>
              </h2>
              {doc !== "all" && (
                <button type="button" className="text-[13px] font-semibold underline underline-offset-2" onClick={() => setDoc("all")}>
                  Show all rules
                </button>
              )}
            </div>
            {docs.length === 0 && manualCount === 0 ? (
              <EmptyState
                title="No rulebooks yet"
                action={
                  manage ? (
                    <Button variant="primary" onClick={() => setImportOpen({ replacing: null })}>
                      Add a rulebook
                    </Button>
                  ) : undefined
                }
              >
                {manage ? "Upload the brand's guidelines PDF and the AI drafts rules from it for you to approve." : "The brand manager adds rulebooks here. Until then, posts for this brand have nothing to be checked against."}
              </EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {docs.map((d) => (
                  <DocCard
                    key={d.id}
                    doc={d}
                    counts={docCounts(live, d.id)}
                    selected={doc === d.id}
                    manage={manage}
                    onSelect={() => setDoc(doc === d.id ? "all" : d.id)}
                    onRename={(n) => setDocField(d, { name: n })}
                    onToggle={() => setDocField(d, { status: d.status === "paused" ? "active" : "paused" })}
                    onReplace={() => setImportOpen({ replacing: d })}
                    onRemove={() => setRemoving(d)}
                  />
                ))}
                {manualCount > 0 && (
                  <li className={`relative min-w-0 rounded-xl border bg-surface p-4 ${doc === MANUAL ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:shadow-[var(--shadow-sheet)]"}`}>
                    <button type="button" onClick={() => setDoc(doc === MANUAL ? "all" : MANUAL)} className="flex w-full items-start gap-3 text-left">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-paper text-[18px] text-ink-soft" aria-hidden="true">
                        ✎
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold">Added by hand</span>
                        <span className="mt-0.5 block text-[12px] text-ink-faint">Rules written in the app</span>
                      </span>
                    </button>
                    <p className="mt-3 text-[13px] text-ink-soft">
                      <strong className="text-ink tabular-nums">{manualCount}</strong> rule{manualCount === 1 ? "" : "s"}
                    </p>
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* drafts banner */}
          {allDrafts > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-med/30 bg-med-bg px-4 py-3">
              <p className="text-[14px] text-med">
                <strong>
                  {allDrafts} drafted rule{allDrafts > 1 ? "s" : ""} waiting for approval.
                </strong>{" "}
                Drafts aren&apos;t used in checks until the brand manager approves them.
              </p>
              {manage && visibleDrafts.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => decideAll("rejected")}>
                    Reject {visibleDrafts.length} shown
                  </Button>
                  <Button size="sm" variant="success" onClick={() => decideAll("approved")}>
                    Approve {visibleDrafts.length} shown
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Rule status" className="flex w-fit rounded-lg border border-line-strong bg-surface p-0.5 text-[13px]">
              {(["all", "draft", "approved", "paused"] as StatusFilter[]).map((s) => {
                const n = statusCount(s);
                if (s === "paused" && n === 0 && status !== "paused") return null;
                return (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={status === s}
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors ${status === s ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
                  >
                    {s === "all" ? "All" : s === "draft" ? "To review" : s === "approved" ? "Approved" : "Paused"}
                    <span className={`tabular-nums ${status === s ? "text-white/70" : "text-ink-faint"}`}>{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value as Category | "all")} aria-label="Category" className="field !w-auto !py-1.5 !text-[13px]">
                <option value="all">Every category</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rules or IDs" aria-label="Search rules" className="field !w-56 !py-1.5 !text-[13px]" />
            </div>
          </div>

          {/* rules */}
          {rules.length === 0 ? (
            <EmptyState title={live.length ? "No rules match" : "No rules yet"}>{live.length ? "Try another filter or clear the search." : manage ? "Add a rulebook from a PDF, or write a rule by hand." : "The brand manager hasn't added any rules for this brand yet."}</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {rules.map((r) => {
                const d = docs.find((x) => x.id === r.document_id);
                return (
                  <li
                    key={r.id}
                    id={r.id}
                    className={`target-flash row-in relative scroll-mt-24 overflow-hidden rounded-xl border bg-surface py-3.5 pl-5 pr-4 ${r.status === "draft" ? "border-med/40" : "border-line"} ${r.status === "paused" ? "opacity-70" : ""}`}
                  >
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${SEVERITY_STYLE[r.severity].dot}`} />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                      <span className="font-mono text-[13.5px] font-semibold">{r.id}</span>
                      <SeverityTag severity={r.severity} />
                      {r.status === "draft" && <span className="rounded-md bg-med-bg px-1.5 py-px font-semibold text-med">Draft</span>}
                      {r.status === "paused" && <span className="rounded-md bg-line px-1.5 py-px font-semibold text-ink-soft">Paused</span>}
                      <span className="text-ink-soft">{CATEGORY_LABEL[r.category]}</span>
                      <span className="text-ink-faint">· {CHECK_LABEL[r.check_type]}</span>
                      {r.scope && r.scope !== "all" && <span className="text-ink-faint">· {r.scope}</span>}
                      {doc === "all" && d && <span className="max-w-[16rem] truncate text-ink-faint">· {d.name}</span>}
                      {manage && editing !== r.id && (
                        <span className="ml-auto flex gap-1">
                          {r.status === "draft" ? (
                            <>
                              <Button size="sm" variant="success" onClick={() => decide(r, "approved")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => decide(r, "rejected")}>
                                Reject
                              </Button>
                            </>
                          ) : null}
                          <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Delete ${r.id}`} title="Delete this rule" className="!px-2 !text-ink-faint hover:!text-high" onClick={() => setDeleting(r)}>
                            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Button>
                        </span>
                      )}
                    </div>
                    {editing === r.id ? (
                      <div className="mt-3 rounded-lg border border-line bg-paper/60 p-4">
                        <RuleEditor rule={r} onCancel={() => setEditing(null)} onSave={(x) => saveEdit(r, x)} />
                      </div>
                    ) : (
                      <>
                        <p className="mt-1.5 text-[15px] font-medium leading-snug">{r.rule}</p>
                        {r.guideline && <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{r.guideline}</p>}
                        {(r.good || r.bad) && (
                          <div className="mt-2.5 grid gap-2 text-[13px] sm:grid-cols-2">
                            {r.good && (
                              <p className="rounded-lg bg-pass-bg px-2.5 py-1.5">
                                <span className="font-semibold text-pass">Do:</span> {r.good}
                              </p>
                            )}
                            {r.bad && (
                              <p className="rounded-lg bg-high-bg px-2.5 py-1.5">
                                <span className="font-semibold text-high">Don&apos;t:</span> {r.bad}
                              </p>
                            )}
                          </div>
                        )}
                        {r.source && <p className="mt-2 text-[12px] text-ink-faint">Drafted by AI from {r.source}</p>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {rejected > 0 && (
            <p className="text-[12px] text-ink-faint">
              {rejected} rejected draft{rejected > 1 ? "s" : ""} hidden. They are kept for the record but never used.
            </p>
          )}
        </>
      )}

      {/* dialogs */}
      <Dialog open={!!importOpen} onClose={() => setImportOpen(null)} title={importOpen?.replacing ? `Replace “${importOpen.replacing.name}”` : "Add a rulebook"} wide>
        {importOpen && (
          <RuleImport
            key={importOpen.replacing?.id ?? "new"}
            role={role}
            actor={name}
            replacing={importOpen.replacing}
            sample={data?.brand.settings.import_sample}
            onDone={async (res) => {
              await reloadBrand();
              if (res.document) {
                setDoc(res.document.id);
                setStatus(res.added.length ? "draft" : "all");
              } else if (res.replaced) setDoc("all");
              toast(res.added.length ? `${res.added.length} rules drafted. Review them below.` : "No new rules found in that file.", res.added.length ? "success" : "info");
            }}
          />
        )}
      </Dialog>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a rule" wide>
        {adding && (
          <RuleEditor
            rule={{ category: "tone", severity: "medium", scope: "all" }}
            onCancel={() => setAdding(false)}
            onSave={async (r) => {
              const res = await send<{ rule: Rule }>("/api/rules", "POST", { role, actor: name, rule: { ...r, status: "approved" } });
              patchBrand((b) => bump({ ...b, rules: [...b.rules, res.rule].sort((x, y) => x.id.localeCompare(y.id)) }));
              setAdding(false);
              setDoc("all");
              setStatus("all");
              toast(`${res.rule.id} added and in use.`);
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) removeDoc(removing); }}
        title={`Remove “${removing?.name}”?`}
        action="Remove rulebook"
      >
        <p>
          Its {removing ? docCounts(live, removing.id).total : 0} rules are deleted and stop being used in checks. Past reports keep their copy. To keep the rules but stop using them for now, pause the rulebook instead.
        </p>
      </ConfirmDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) removeRule(deleting); }} title={`Delete ${deleting?.id}?`} action="Delete rule">
        <p>“{deleting?.rule}” is removed from the Rulebook and won&apos;t be used in checks. Past reports keep their copy of it.</p>
      </ConfirmDialog>
    </div>
  );
}
