"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { analyzeImage, shrinkImage } from "@/lib/client/analyze-image";
import { SAMPLE_HINT, SAMPLE_LABEL, samplePosts, type SamplePost } from "@/lib/demo/samples";
import type { Channel, PostImage, PostInput } from "@/lib/types";
import { Button, ErrorNote } from "./ui";
import { useToast } from "./toast";
import { send, toBase64 } from "@/lib/client/send";
import { LivePreview } from "./live-preview";
import { useBrand } from "@/lib/client/use-brand";
import { refreshPosts } from "@/lib/client/use-posts";
import { useRole } from "./role-provider";
import { can, ROLE_INFO } from "@/lib/roles";
import Link from "next/link";

const POST_TYPES = ["product", "launch", "offer", "partner", "sustainability", "company update", "promo"];
const EMPTY: PostInput = { channel: "instagram", post_type: "product", product: "", partner: false, caption: "", images: [] };

interface Sample extends SamplePost {
  label: string;
  hint: string;
}

interface DraftImage extends PostImage {
  preview: string; // what we show and analyse (full quality)
}

export function ComposeForm() {
  const router = useRouter();
  const { role, name, setRole } = useRole();
  const writer = can(role, "check_posts");
  const [input, setInput] = useState<PostInput>(EMPTY);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const toast = useToast();
  const brandData = useBrand();
  const settings = brandData?.brand.settings;
  // the demo brand's samples are built in; other brands bring their own in their settings
  const samples: Sample[] | null = !brandData
    ? null
    : settings?.samples?.length
      ? settings.samples.map((x) => ({ ...x, images: x.images.map((i) => ({ ...i })) }))
      : brandData.brand.slug === "oatvia"
        ? samplePosts().map((x) => ({ ...x, label: SAMPLE_LABEL[x.id] ?? x.id, hint: SAMPLE_HINT[x.id] ?? x.title }))
        : [];
  const products = [...(settings?.products ?? []), "Brand"];
  const rulesInUse = (brandData?.rules ?? []).filter((r) => r.status === "approved").length;
  // after switching brand, a product from the old brand no longer applies
  const product = input.product && products.includes(input.product) ? input.product : products[0] || "Brand";
  const slug = brandData?.brand.slug ?? null;
  const [seenSlug, setSeenSlug] = useState(slug);
  if (slug !== seenSlug) {
    setSeenSlug(slug);
    setSampleId(null);
  }

  const set = <K extends keyof PostInput>(k: K, v: PostInput[K]) => {
    setInput((p) => ({ ...p, [k]: v }));
    setSampleId(null);
  };

  function loadSample(s: Sample) {
    setInput({ title: s.title, channel: s.channel, post_type: s.post_type, product: s.product, partner: s.partner, caption: s.caption, images: [] });
    setImages(s.images.map((i) => ({ ...i, preview: i.src })));
    setSampleId(s.id);
    setError(null);
  }

  const IMAGE_TYPE = /^image\/(png|jpeg|webp|gif|bmp|avif)$/;
  const DOC_NAME = /\.(pdf|docx|txt|md)$/i;

  /** Images become post images; a document (PDF, Word, text) fills the caption. Used by the file picker, drag and drop, and paste. */
  async function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setFileNote(null);
    const imgs = files.filter((f) => IMAGE_TYPE.test(f.type));
    const docs = files.filter((f) => !IMAGE_TYPE.test(f.type) && (DOC_NAME.test(f.name) || f.type === "application/pdf" || f.type.startsWith("text/")));
    const skipped = files.length - imgs.length - docs.length;
    const notes: string[] = [];

    if (imgs.length) {
      const room = 5 - images.length;
      const tooBig = imgs.filter((f) => f.size > 10 * 1024 * 1024);
      const picked = imgs.filter((f) => f.size <= 10 * 1024 * 1024).slice(0, Math.max(0, room));
      if (room <= 0) notes.push("A post can have up to 5 images; remove one to add another.");
      else if (imgs.length - tooBig.length > room) notes.push(`Only ${room} more image${room === 1 ? " fits" : "s fit"} (5 per post), so the rest were left out.`);
      if (tooBig.length) notes.push("Images over 10 MB were left out.");
      const added = await Promise.all(
        picked.map(
          (f) =>
            new Promise<DraftImage>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ src: "", alt_text: "", preview: String(reader.result) });
              reader.readAsDataURL(f);
            }),
        ),
      );
      if (added.length) {
        setImages((prev) => [...prev, ...added].slice(0, 5));
        setSampleId(null);
        toast(`${added.length} image${added.length === 1 ? "" : "s"} added. Describe ${added.length === 1 ? "it" : "each one"} in the alt text.`);
      }
    }

    if (docs.length) {
      const doc = docs[0];
      if (docs.length > 1) notes.push("Only the first document was used for the caption.");
      if (doc.size > 3 * 1024 * 1024) notes.push("That document is too big. Use one under 3 MB.");
      else {
        setReading(doc.name);
        try {
          let text: string;
          let truncated = false;
          if (/\.(txt|md)$/i.test(doc.name) || (doc.type.startsWith("text/") && !/\.(pdf|docx)$/i.test(doc.name))) {
            const raw = (await doc.text()).replace(/\r\n/g, "\n").trim();
            text = raw.slice(0, 3000);
            truncated = raw.length > 3000;
          } else {
            const res = await send<{ text: string; truncated: boolean }>("/api/extract", "POST", { file: { name: doc.name, type: doc.type, base64: toBase64(await doc.arrayBuffer()) } });
            text = res.text;
            truncated = res.truncated;
          }
          if (!text.trim()) throw new Error("No readable text found in that document.");
          setInput((p) => ({ ...p, caption: text }));
          setSampleId(null);
          toast(`Caption filled from “${doc.name}”${truncated ? " (first 3,000 characters)" : ""}.`);
        } catch (e) {
          notes.push(e instanceof Error ? e.message : String(e));
        } finally {
          setReading(null);
        }
      }
    }

    if (skipped) notes.push("Some files were skipped: use PNG, JPEG, WebP or GIF images, or a PDF, Word, .txt or .md document.");
    setFileNote(notes.length ? notes.join(" ") : null);
  }

  // Paste images straight from the clipboard (a screenshot, or an image copied from another app).
  // Text pasted into a field keeps working as usual.
  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => IMAGE_TYPE.test(f.type) || DOC_NAME.test(f.name));
      if (!files.length) return;
      const inField = (e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]");
      const hasText = !!e.clipboardData?.getData("text/plain");
      if (inField && hasText) return; // copied text (and its preview image) goes into the field as text
      e.preventDefault();
      void addFilesRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check() {
    setError(null);
    if (!input.caption.trim()) {
      setError("Write a caption first, or pick a sample post.");
      return;
    }
    try {
      const prepared: PostImage[] = [];
      for (const [i, img] of images.entries()) {
        setBusy(`Reading image ${i + 1} of ${images.length}…`);
        const analysis = img.analysis ?? (await analyzeImage(img.preview, (s) => setBusy(`Image ${i + 1}: ${s}`)));
        const src = img.src || (await shrinkImage(img.preview));
        prepared.push({ src, alt_text: img.alt_text, analysis });
      }
      setBusy("Checking against the rules and the Fact Bank…");
      const res = await api.review({ sample_id: sampleId ?? undefined, role, actor: name, input: { ...input, product, images: prepared } });
      void refreshPosts();
      router.push(`/posts/${res.post_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      // the page stays mounted in the background after navigating, so always reset the button
      setBusy(null);
    }
  }

  const field = "w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[14px]";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="check-title">
        <h1 id="check-title" className="text-[32px] font-bold leading-tight tracking-tight">
          Check a post before it goes live
        </h1>
        <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
          Paste a caption and add images. Every problem comes with the rule or approved fact that proves it, and a fix that keeps your message.
          {brandData && <> Checking against <strong className="font-semibold text-ink">{brandData.brand.name}</strong>&apos;s Rulebook.</>}
        </p>

        <div
          className="relative mt-6 rounded-2xl border border-line bg-surface shadow-[var(--shadow-sheet)]"
          onDragEnter={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-start gap-1 rounded-2xl pt-32 border-2 border-dashed border-low bg-low-bg/90 text-center">
              <p className="text-[17px] font-bold text-low">Drop to add</p>
              <p className="text-[13px] text-ink-soft">Images are added to the post. A PDF, Word or text document fills the caption.</p>
            </div>
          )}
          <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-3">
            <label className="text-[13px]">
              <span className="mb-1 block font-medium text-ink-soft">Channel</span>
              <select value={input.channel} onChange={(e) => set("channel", e.target.value as Channel)} className={field}>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
                <option value="website">Website</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label className="text-[13px]">
              <span className="mb-1 block font-medium text-ink-soft">Post type</span>
              <select value={input.post_type} onChange={(e) => set("post_type", e.target.value)} className={field}>
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px]">
              <span className="mb-1 block font-medium text-ink-soft">Product</span>
              <select value={product} onChange={(e) => set("product", e.target.value)} className={field}>
                {products.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[14px] sm:col-span-3">
              <input type="checkbox" checked={input.partner} onChange={(e) => set("partner", e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
              Paid partner or influencer post
            </label>
          </div>

          <label className="block px-5 pt-5">
            <span className="flex items-baseline justify-between text-[13px] font-medium text-ink-soft">
              Caption <span className="font-normal tabular-nums text-ink-faint">{input.caption.length} / 3000</span>
            </span>
            <textarea
              value={input.caption}
              onChange={(e) => set("caption", e.target.value)}
              rows={6}
              maxLength={3000}
              placeholder="Write or paste the post text, including hashtags"
              className="mt-2 w-full resize-y rounded-lg border-0 bg-paper/60 px-4 py-3 font-serif text-[20px] leading-[1.6] placeholder:text-ink-faint focus:bg-surface focus:outline-2 focus:outline-low"
            />
          </label>

          <LivePreview input={{ ...input, product }} />

          <div className="px-5 pt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink-soft">Images ({images.length} of 5)</span>
              <span className="hidden text-[12px] text-ink-faint sm:inline">Tip: paste a screenshot with Ctrl+V (⌘V on Mac)</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                multiple
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
            {images.length > 0 && (
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {images.map((img, i) => (
                  <li key={i} className="row-in flex gap-3 rounded-lg border border-line p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt={img.alt_text || `Image ${i + 1} preview`} className="size-20 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <label className="block">
                        <span className="text-[12px] text-ink-soft">Alt text (what the image shows)</span>
                        <input
                          value={img.alt_text}
                          onChange={(e) => setImages((prev) => prev.map((p, j) => (j === i ? { ...p, alt_text: e.target.value } : p)))}
                          className="mt-0.5 w-full rounded-md border border-line-strong px-2 py-1"
                          placeholder="Describe the image"
                        />
                      </label>
                      <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="mt-1 text-[12px] text-ink-soft underline">
                        Remove image
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {images.length < 5 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!!reading}
                className={`mt-2 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-paper/40 px-4 text-center transition-colors hover:border-ink-faint hover:bg-paper ${images.length ? "py-3" : "py-6"}`}
              >
                {reading ? (
                  <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink" role="status">
                    <span aria-hidden="true" className="inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink motion-reduce:animate-none" />
                    Reading “{reading}”…
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {images.length ? "Add more: drop, paste or click" : "Drop images or a document here, paste, or click to choose"}
                    </span>
                    {!images.length && (
                      <span className="text-[12px] text-ink-faint">
                        Up to 5 images (PNG, JPEG, WebP, GIF); text inside them is read and checked too. A PDF, Word, .txt or .md document fills the caption.
                      </span>
                    )}
                  </>
                )}
              </button>
            )}
            {fileNote && (
              <p role="status" className="mt-2 rounded-lg bg-med-bg px-3 py-2 text-[13px] text-med">
                {fileNote}
              </p>
            )}
          </div>

          {brandData && rulesInUse === 0 && (
            <p className="mx-5 mt-5 rounded-xl border border-med/30 bg-med-bg px-4 py-3 text-[13px] text-med">
              <strong>{brandData.brand.name} has no approved rules yet</strong>, so a check can only test claims against the Fact Bank.{" "}
              <Link href="/rulebook" className="font-semibold underline underline-offset-2">
                {can(role, "manage_rules") ? "Add a rulebook" : "See the Rulebook"}
              </Link>
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
            {writer ? (
              <>
                <Button variant="primary" onClick={check} disabled={!!busy}>
                  {busy ? "Checking…" : "Check post"}
                </Button>
                {busy ? (
                  <span className="text-[14px] text-ink-soft" aria-live="polite">
                    {busy}
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-faint">Takes a few seconds. Nothing is published.</span>
                )}
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => setRole("creator")}>
                  Switch to Creator to check
                </Button>
                <span className="text-[13px] text-ink-soft">
                  Creators write and check posts. As {ROLE_INFO[role].label.toLowerCase()}, you review them in the{" "}
                  <Link href="/queue" className="font-semibold text-ink underline underline-offset-2">
                    Review queue
                  </Link>
                  .
                </span>
              </>
            )}
          </div>
          {error && (
            <div className="px-5 pb-5">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-8 lg:pt-2">
        <section aria-labelledby="samples-title">
          <h2 id="samples-title" className="text-[15px] font-semibold tracking-tight">
            Start with a sample post
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            {brandData ? `${brandData.brand.name} posts with real mistakes planted in them.` : "Posts with real mistakes planted in them."}
          </p>
          {!samples && <div className="mt-3 h-96 animate-pulse rounded-xl bg-line/70 motion-reduce:animate-none" aria-hidden="true" />}
          {samples && samples.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-line-strong p-4 text-[13px] text-ink-soft">No sample posts for this brand yet. Write your own.</p>}
          <ul className={`mt-3 overflow-hidden rounded-xl border border-line bg-surface ${samples?.length ? "" : "hidden"}`}>
            {(samples ?? []).map((s) => {
              const on = sampleId === s.id;
              return (
                <li key={s.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => loadSample(s)}
                    aria-pressed={on}
                    className={`block w-full px-4 py-2.5 text-left transition-colors ${on ? "bg-ink text-white" : "hover:bg-paper"}`}
                  >
                    <span className="block text-[14px] font-semibold">{s.label}</span>
                    <span className={`block text-[13px] leading-snug ${on ? "text-white/75" : "text-ink-soft"}`}>{s.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how-title">
          <h2 id="how-title" className="text-[15px] font-semibold tracking-tight">
            How a check decides
          </h2>
          <ol className="mt-3 space-y-3 text-[14px] leading-snug">
            {[
              ["Fast checks", "Plain code finds exact problems: names, numbers, claims, colours, contrast."],
              ["AI check", "Looks for reworded claims and tone. Personal details are hidden from it."],
              ["Proof check", "Drops any AI finding without a real rule, quote and fact."],
              ["People decide", "You accept, edit or disagree with each fix. A named person approves the post."],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[28px_1fr] gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border border-line-strong text-[12px] font-semibold tabular-nums text-ink-soft">{i + 1}</span>
                <span>
                  <span className="font-semibold">{t}.</span> <span className="text-ink-soft">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium">
            <a href="/tests" className="underline underline-offset-4">
              Test results on the sample posts
            </a>
            {settings?.guidelines_pdf && (
              <a href={settings.guidelines_pdf} target="_blank" className="underline underline-offset-4">
                {brandData?.brand.name} guidelines (PDF)
              </a>
            )}
          </p>
        </section>
      </aside>
    </div>
  );
}
