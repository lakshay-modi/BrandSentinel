"use client";

import { useEffect, useState } from "react";
import { useHashScroll } from "@/lib/client/use-hash-scroll";
import { api, type BrandData } from "@/lib/client/api";
import type { Fact } from "@/lib/types";
import { Button, ErrorNote, PageSkeleton } from "./ui";
import { useRole } from "./role-provider";

const TYPES = ["nutrition", "allergen", "diet", "origin", "environment", "price", "availability", "offer", "company", "restriction", "general"];

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function FactForm({ fact, onSave, onCancel }: { fact: Partial<Fact>; onSave: (f: Partial<Fact>) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState(fact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = (k: keyof Fact, label: string, type = "text") => (
    <label className="block text-xs text-ink-soft">
      {label}
      <input type={type} required value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-sm text-ink" />
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
          await onSave(f);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        {input("product", "Product")}
        {input("fact", "Fact (exact wording that may be used)")}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {input("source", "Source (report, certificate…)")}
        {input("valid_until", "Valid until", "date")}
        <label className="block text-xs text-ink-soft">
          Type
          <select value={f.type ?? "general"} onChange={(e) => setF({ ...f, type: e.target.value })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-sm text-ink">
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" type="submit" disabled={busy}>
          {fact.id ? "Save fact" : "Add fact"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function FactsView() {
  const { role, name } = useRole();
  const [data, setData] = useState<BrandData | null>(null);
  useHashScroll(!!data);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

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

  const canEdit = role !== "creator";
  const today = data?.today ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Fact Bank</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            The only facts posts may use. Every claim is compared with this list. Each fact has a source and an end date; after the end date it can no longer be used as proof.
          </p>
        </div>
        {canEdit ? (
          <Button variant="primary" onClick={() => setEditing("new")}>
            Add a fact
          </Button>
        ) : (
          <p className="text-xs text-ink-faint">Switch to Brand manager or Expert reviewer to edit facts.</p>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {editing === "new" && (
        <FactForm
          fact={{ type: "general", valid_until: "" }}
          onCancel={() => setEditing(null)}
          onSave={async (f) => {
            await send("/api/facts", "POST", { role, actor: name, fact: f });
            setEditing(null);
            await reload();
          }}
        />
      )}
      {!data && !error && <PageSkeleton rows={6} />}
      {data && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Fact</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Valid until</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.facts.map((f) =>
                editing === f.id ? (
                  <tr key={f.id}>
                    <td colSpan={6} className="p-3">
                      <FactForm
                        fact={f}
                        onCancel={() => setEditing(null)}
                        onSave={async (x) => {
                          const { product, fact, source, valid_until, type } = x;
                          await send(`/api/facts/${f.id}`, "PATCH", { role, actor: name, changes: { product, fact, source, valid_until, type } });
                          setEditing(null);
                          await reload();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={f.id} id={f.id} className={`target-flash scroll-mt-24 ${f.valid_until < today ? "bg-paper text-ink-faint" : ""}`}>
                    <td className="px-3 py-2 font-mono font-semibold">{f.id}</td>
                    <td className="px-3 py-2">{f.product}</td>
                    <td className="px-3 py-2">{f.fact}</td>
                    <td className="px-3 py-2 text-ink-soft">{f.source}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {f.valid_until}
                      {f.valid_until < today && <span className="ml-2 rounded bg-high-bg px-1.5 py-0.5 text-xs font-semibold text-high">Expired</span>}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(f.id)}>
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
