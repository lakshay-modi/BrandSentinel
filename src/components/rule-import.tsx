"use client";

import { useState } from "react";
import { Button, ErrorNote } from "./ui";

interface ImportResult {
  added: string[];
  duplicates: { rule: string; duplicate_of: string }[];
  unproven: string[];
  pages: number;
  truncated: boolean;
}

const SAMPLE = { url: "/demo/Oatvia_Social_Addendum.pdf", name: "Oatvia_Social_Addendum.pdf" };

function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Brand manager uploads a guidelines document; the AI drafts rules for approval. */
export function RuleImport({ role, actor, onDone, onClose }: { role: string; actor: string; onDone: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run(name: string, type: string, buf: ArrayBuffer) {
    setError(null);
    setResult(null);
    if (buf.byteLength > 3 * 1024 * 1024) {
      setError("That file is too big. Use a PDF under 3 MB.");
      return;
    }
    setBusy(`Reading “${name}” and drafting rules… (up to a minute)`);
    try {
      const res = await fetch("/api/rules/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, actor, file: { name, type, base64: toBase64(buf) } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Import failed (${res.status})`);
      setResult(data as ImportResult);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Import rules from a guidelines document</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Upload a PDF (or .txt / .md). The AI drafts checkable rules, plain code checks that each one quotes a real sentence from the document, and rules the Rulebook already has are skipped. New rules arrive as{" "}
            <strong>drafts</strong>: they aren&apos;t used in checks until you approve them.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex cursor-pointer items-center rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper ${busy ? "pointer-events-none opacity-50" : ""}`}>
          Choose a file
          <input
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="sr-only"
            disabled={!!busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) await run(f.name, f.type, await f.arrayBuffer());
            }}
          />
        </label>
        <span className="text-sm text-ink-faint">or</span>
        <Button
          size="sm"
          disabled={!!busy}
          onClick={async () => {
            const res = await fetch(SAMPLE.url);
            await run(SAMPLE.name, "application/pdf", await res.arrayBuffer());
          }}
        >
          Try the sample addendum
        </Button>
        <a href={SAMPLE.url} target="_blank" className="text-xs text-ink-soft underline">
          View sample PDF
        </a>
      </div>

      {busy && <p className="text-sm text-ink-soft" role="status">{busy}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {result && (
        <div className="space-y-2 rounded-md bg-paper p-3 text-sm" role="status">
          <p>
            <strong>
              {result.added.length} draft rule{result.added.length === 1 ? "" : "s"} added
            </strong>
            {result.added.length > 0 && <span className="text-ink-soft"> ({result.added.join(", ")}). Review them below, then approve, edit or reject each one.</span>}
          </p>
          {result.duplicates.length > 0 && (
            <div>
              <p className="font-medium">Already in the Rulebook, so skipped:</p>
              <ul className="ml-4 list-disc text-ink-soft">
                {result.duplicates.map((d) => (
                  <li key={d.rule}>
                    “{d.rule}” → same as <span className="font-mono">{d.duplicate_of}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.unproven.length > 0 && (
            <p className="text-ink-soft">
              {result.unproven.length} suggestion{result.unproven.length === 1 ? " was" : "s were"} dropped because the quoted sentence isn&apos;t in the document.
            </p>
          )}
          {result.truncated && <p className="text-ink-faint">The document is long, so only the first part was read.</p>}
        </div>
      )}
    </section>
  );
}
