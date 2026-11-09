"use client";

import { useEffect, useState } from "react";
import type { GuidelineDoc } from "@/lib/types";
import { Button, ErrorNote } from "./ui";

export interface ImportResult {
  document: { id: string; name: string } | null;
  replaced: boolean;
  added: string[];
  duplicates: { rule: string; duplicate_of: string }[];
  unproven: string[];
  pages: number;
  truncated: boolean;
}

const MAX_BYTES = 3 * 1024 * 1024;

function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const niceName = (file: string) => file.replace(/\.(pdf|txt|md)$/i, "").replace(/[_-]+/g, " ").trim();

function Spinner() {
  return <span aria-hidden="true" className="inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink motion-reduce:animate-none" />;
}

/**
 * Add a rulebook (or replace one) from a guidelines document. The AI drafts rules, plain code checks each one
 * quotes a real sentence from the document, and the rules arrive as drafts for the brand manager to approve.
 */
export function RuleImport({
  role,
  actor,
  sample,
  replacing,
  onDone,
}: {
  role: string;
  actor: string;
  sample?: { url: string; name: string; label: string };
  /** the rulebook being replaced, if this is a replacement */
  replacing?: GuidelineDoc | null;
  onDone: (result: ImportResult) => void;
}) {
  const [file, setFile] = useState<{ name: string; type: string; buf: ArrayBuffer } | null>(null);
  const [title, setTitle] = useState(replacing?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  function pick(name: string, type: string, buf: ArrayBuffer) {
    setError(null);
    setResult(null);
    if (buf.byteLength > MAX_BYTES) return setError("That file is too big. Use a PDF under 3 MB.");
    if (!/\.(pdf|txt|md)$/i.test(name) && !/pdf|text/.test(type)) return setError("Use a PDF, .txt or .md file.");
    setFile({ name, type, buf });
    if (!replacing && !title) setTitle(niceName(name).slice(0, 80));
  }

  async function run() {
    if (!file) return;
    setError(null);
    setBusy(true);
    setSeconds(0);
    try {
      const res = await fetch("/api/rules/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          actor,
          ...(title.trim().length >= 2 ? { title: title.trim().slice(0, 80) } : {}),
          ...(replacing ? { replace_document_id: replacing.id } : {}),
          file: { name: file.name, type: file.type, base64: toBase64(file.buf) },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Import failed (${res.status})`);
      setResult(data as ImportResult);
      onDone(data as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 text-[14px]" role="status">
        <div className="rounded-xl bg-pass-bg px-4 py-3 text-pass">
          <p className="font-semibold">
            {result.added.length} draft rule{result.added.length === 1 ? "" : "s"} added{result.document ? ` to “${result.document.name}”` : ""}
            {result.replaced ? ", and the old rulebook was replaced" : ""}.
          </p>
          {result.added.length > 0 && <p className="mt-0.5 text-[13px]">Approve, edit or reject each one: drafts aren&apos;t used in checks until approved.</p>}
        </div>
        {result.duplicates.length > 0 && (
          <div>
            <p className="font-medium">Already in the Rulebook, so skipped ({result.duplicates.length}):</p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[13px] text-ink-soft thin-scroll">
              {result.duplicates.map((d) => (
                <li key={d.rule}>
                  “{d.rule}” <span className="text-ink-faint">→ same as</span> <span className="font-mono">{d.duplicate_of}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.unproven.length > 0 && (
          <p className="text-[13px] text-ink-soft">
            {result.unproven.length} suggestion{result.unproven.length === 1 ? " was" : "s were"} dropped because the quoted sentence isn&apos;t in the document.
          </p>
        )}
        {result.truncated && <p className="text-[13px] text-ink-faint">The document is long, so only the first part was read.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-ink-soft">
        {replacing ? (
          <>
            Upload the correct file. Once its rules are drafted, <strong className="text-ink">“{replacing.name}”</strong> and its rules are removed. If drafting fails, nothing changes.
          </>
        ) : (
          <>
            Upload a PDF, .txt or .md. The AI drafts checkable rules, plain code checks each one quotes a real sentence from the file, and rules the brand already has are skipped. New rules arrive as{" "}
            <strong className="text-ink">drafts</strong>.
          </>
        )}
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) pick(f.name, f.type, await f.arrayBuffer());
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
          dragging ? "border-low bg-low-bg" : file ? "border-pass/50 bg-pass-bg/50" : "border-line-strong bg-paper/60 hover:border-ink-faint"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="text-ink-faint">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M12 18v-6 M9.5 14.5 12 12l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {file ? (
          <>
            <span className="text-[14px] font-semibold">{file.name}</span>
            <span className="text-[12px] text-ink-faint">{(file.buf.byteLength / 1024).toFixed(0)} KB · click to choose another file</span>
          </>
        ) : (
          <>
            <span className="text-[14px] font-semibold">Drop a guidelines file here, or click to choose</span>
            <span className="text-[12px] text-ink-faint">PDF with selectable text, .txt or .md, up to 3 MB</span>
          </>
        )}
        <input
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pick(f.name, f.type, await f.arrayBuffer());
          }}
        />
      </label>

      {sample && !file && (
        <p className="text-[13px] text-ink-soft">
          No file to hand?{" "}
          <button
            type="button"
            className="font-semibold text-ink underline underline-offset-2"
            onClick={async () => {
              const res = await fetch(sample.url);
              pick(sample.name, "application/pdf", await res.arrayBuffer());
            }}
          >
            {sample.label}
          </button>{" "}
          (
          <a href={sample.url} target="_blank" rel="noopener" className="underline underline-offset-2">
            view it
          </a>
          )
        </p>
      )}

      <label className="block">
        <span className="field-label">Rulebook name</span>
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Social media guidelines 2026" className="field mt-1" />
        <span className="field-hint">Shown on the Rulebook page, so you can tell several rulebooks apart.</span>
      </label>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-soft" role="status">
          {busy && (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              {seconds < 6 ? "Reading the file…" : seconds < 40 ? "The AI is drafting rules…" : "Still drafting; long files take up to a minute…"} {seconds}s
            </span>
          )}
        </p>
        <Button variant="primary" disabled={!file || busy} onClick={run}>
          {replacing ? "Replace rulebook" : "Draft rules"}
        </Button>
      </div>
    </div>
  );
}
