"use client";

import { useState } from "react";
import { useHashScroll } from "@/lib/client/use-hash-scroll";
import { optimistic, patchBrand, useBrandState } from "@/lib/client/use-brand";
import { send } from "@/lib/client/send";
import { can } from "@/lib/roles";
import type { Fact } from "@/lib/types";
import { Button, ConfirmDialog, Dialog, EmptyState, ErrorNote, PageSkeleton } from "./ui";
import { useRole } from "./role-provider";
import { RoleNote } from "./role-note";
import { useToast } from "./toast";

const TYPES = ["nutrition", "allergen", "diet", "origin", "environment", "price", "availability", "offer", "company", "restriction", "general"];

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function FactForm({ fact, onSave, onCancel }: { fact: Partial<Fact>; onSave: (f: Partial<Fact>) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState(fact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = (k: keyof Fact, label: string, type = "text", hint?: string) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} required value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="field mt-1" />
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
          await onSave(f);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setBusy(false);
        }
      }}
    >
      {input("product", "Product", "text", "Or “All products” for a company-wide fact.")}
      {input("fact", "Fact", "text", "The exact wording posts may use, for example “12 g protein per 250 ml”.")}
      <div className="grid gap-3 sm:grid-cols-3">
        {input("source", "Source", "text", "Lab report, certificate…")}
        {input("valid_until", "Valid until", "date")}
        <label className="block">
          <span className="field-label">Type</span>
          <select value={f.type ?? "general"} onChange={(e) => setF({ ...f, type: e.target.value })} className="field mt-1">
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          {fact.id ? "Save fact" : "Add fact"}
        </Button>
      </div>
    </form>
  );
}

export function FactsView() {
  const { role, name } = useRole();
  const { data, error } = useBrandState();
  useHashScroll(!!data);
  const toast = useToast();
  const manage = can(role, "manage_facts");
  const [editing, setEditing] = useState<Fact | "new" | null>(null);
  const [deleting, setDeleting] = useState<Fact | null>(null);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "expired" | "soon">("all");

  const today = data?.today ?? "";
  const soon = today ? addDays(today, 30) : "";
  const facts = data?.facts ?? [];
  const expired = facts.filter((f) => f.valid_until < today).length;
  const expiring = facts.filter((f) => f.valid_until >= today && f.valid_until <= soon).length;
  const q = query.trim().toLowerCase();
  const shown = facts
    .filter((f) => show === "all" || (show === "expired" ? f.valid_until < today : f.valid_until >= today && f.valid_until <= soon))
    .filter((f) => !q || `${f.id} ${f.product} ${f.fact} ${f.source} ${f.type}`.toLowerCase().includes(q));

  const fail = (m: string) => toast(m, "error");

  const save = async (x: Partial<Fact>) => {
    const { product, fact, source, valid_until, type } = x;
    const changes = { product, fact, source, valid_until, type };
    if (editing === "new") {
      const res = await send<{ fact: Fact }>("/api/facts", "POST", { role, actor: name, fact: changes });
      patchBrand((b) => ({ ...b, facts: [...b.facts, res.fact] }));
      toast(`${res.fact.id} added. Posts can now use it as proof.`);
    } else if (editing) {
      const id = editing.id;
      toast(`${id} saved.`);
      void optimistic(
        (b) => ({ ...b, facts: b.facts.map((f) => (f.id === id ? ({ ...f, ...changes } as Fact) : f)) }),
        () => send(`/api/facts/${id}`, "PATCH", { role, actor: name, changes }),
        fail,
      );
    }
    setEditing(null);
  };

  const remove = (f: Fact) => {
    setDeleting(null);
    toast(`${f.id} removed. Claims that relied on it will be flagged.`, "info");
    void optimistic(
      (b) => ({ ...b, facts: b.facts.filter((x) => x.id !== f.id) }),
      () => send(`/api/facts/${f.id}`, "DELETE", { role, actor: name }),
      fail,
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Fact Bank</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            The only facts {data?.brand.name ?? "the brand"}&apos;s posts may use. Every claim is compared with this list. Each fact has a source and an end date; after that date it no longer counts as proof.
          </p>
        </div>
        {manage && data && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            <span aria-hidden="true" className="text-[17px] leading-none">+</span> Add a fact
          </Button>
        )}
      </div>

      <RoleNote
        notes={{
          creator: "Read-only for you. Use these facts word for word in posts; a claim that isn't here gets flagged.",
          expert: "You keep this list true: add new facts with their source, correct wording, and remove facts that no longer hold.",
          brand_manager: "You can add, correct and remove facts. The expert reviewer usually looks after this list.",
        }}
      />

      {error && !data && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <PageSkeleton rows={6} />}

      {data && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Show" className="flex w-fit rounded-lg border border-line-strong bg-surface p-0.5 text-[13px]">
              {(
                [
                  ["all", "All", facts.length],
                  ["soon", "Ending in 30 days", expiring],
                  ["expired", "Expired", expired],
                ] as const
              ).map(([k, label, n]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={show === k}
                  onClick={() => setShow(k)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-colors ${show === k ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
                >
                  {label}
                  <span className={`tabular-nums ${show === k ? "text-white/70" : k === "expired" && n ? "text-high" : "text-ink-faint"}`}>{n}</span>
                </button>
              ))}
            </div>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search facts, products or IDs" aria-label="Search facts" className="field !w-64 !py-1.5 !text-[13px]" />
          </div>

          {shown.length === 0 ? (
            <EmptyState
              title={facts.length ? "No facts match" : "No facts yet"}
              action={
                !facts.length && manage ? (
                  <Button variant="primary" onClick={() => setEditing("new")}>
                    Add the first fact
                  </Button>
                ) : undefined
              }
            >
              {facts.length ? "Try another filter or clear the search." : "Without facts, every number or health claim in a post is flagged as unproven."}
            </EmptyState>
          ) : (
            <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
              {/* a table on wide screens; on phones each fact is a small card */}
              <table className="block w-full text-left text-[14px] sm:table sm:min-w-[760px]">
                <thead className="hidden border-b border-line bg-paper/70 text-[12px] uppercase tracking-wide text-ink-soft sm:table-header-group">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">ID</th>
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-4 py-2.5 font-semibold">Fact</th>
                    <th className="px-4 py-2.5 font-semibold">Source</th>
                    <th className="px-4 py-2.5 font-semibold">Valid until</th>
                    {manage && (
                      <th className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="block divide-y divide-line sm:table-row-group">
                  {shown.map((f) => {
                    const isExpired = f.valid_until < today;
                    const isSoon = !isExpired && f.valid_until <= soon;
                    return (
                      <tr key={f.id} id={f.id} className={`target-flash row-in group grid scroll-mt-24 grid-cols-[auto_1fr] gap-x-3 px-4 py-3 sm:table-row sm:p-0 ${isExpired ? "bg-paper/60 text-ink-faint" : "hover:bg-paper/40"}`}>
                        <td className="align-top font-mono text-[13px] font-semibold sm:px-4 sm:py-3">{f.id}</td>
                        <td className="align-top font-semibold sm:px-4 sm:py-3 sm:font-normal">{f.product}</td>
                        <td className="col-span-2 mt-1 align-top sm:mt-0 sm:px-4 sm:py-3">
                          {f.fact}
                          <span className="ml-2 text-[11px] uppercase tracking-wide text-ink-faint">{f.type}</span>
                        </td>
                        <td className="col-span-2 align-top text-[13px] text-ink-soft sm:px-4 sm:py-3 sm:text-[14px]">
                          <span className="sm:hidden">Source: </span>
                          {f.source}
                        </td>
                        <td className="col-span-2 whitespace-nowrap align-top text-[13px] tabular-nums sm:px-4 sm:py-3 sm:text-[14px]">
                          <span className="text-ink-soft sm:hidden">Valid until </span>
                          {f.valid_until}
                          {isExpired && <span className="ml-2 rounded-md bg-high-bg px-1.5 py-px text-[11px] font-bold text-high">Expired</span>}
                          {isSoon && <span className="ml-2 rounded-md bg-med-bg px-1.5 py-px text-[11px] font-bold text-med">Ends soon</span>}
                        </td>
                        {manage && (
                          <td className="col-span-2 -ml-3 mt-1 whitespace-nowrap align-top sm:ml-0 sm:mt-0 sm:px-3 sm:py-2 sm:text-right">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" className="!text-ink-faint hover:!text-high" onClick={() => setDeleting(f)} aria-label={`Remove ${f.id}`}>
                              Remove
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add a fact" : `Edit ${editing?.id ?? ""}`} wide>
        {editing && <FactForm key={editing === "new" ? "new" : editing.id} fact={editing === "new" ? { type: "general", valid_until: "" } : editing} onCancel={() => setEditing(null)} onSave={save} />}
      </Dialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) remove(deleting); }} title={`Remove ${deleting?.id}?`} action="Remove fact">
        <p>
          “{deleting?.fact}” stops counting as proof. Posts that make this claim will be flagged as unproven. To keep it on record but stop it being used, set its end date to yesterday instead.
        </p>
      </ConfirmDialog>
    </div>
  );
}
