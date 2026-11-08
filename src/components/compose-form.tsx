"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { analyzeImage, shrinkImage } from "@/lib/client/analyze-image";
import { SAMPLE_HINT, SAMPLE_LABEL, samplePosts, type SamplePost } from "@/lib/demo/samples";
import type { Channel, PostImage, PostInput } from "@/lib/types";
import { Button, ErrorNote } from "./ui";
import { LivePreview } from "./live-preview";
import { useBrand } from "@/lib/client/use-brand";
import { useRole } from "./role-provider";

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
  const { role, name } = useRole();
  const [input, setInput] = useState<PostInput>(EMPTY);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const product = input.product || products[0] || "Brand";

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

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = 5 - images.length;
    const picked = Array.from(files).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type)).slice(0, room);
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
    setImages((prev) => [...prev, ...added]);
    setSampleId(null);
    if (fileRef.current) fileRef.current.value = "";
  }

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

        <div className="mt-6 rounded-2xl border border-line bg-surface shadow-[var(--shadow-sheet)]">
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
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-soft">Images ({images.length} of 5)</span>
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={images.length >= 5}>
                Add image
              </Button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            </div>
            {images.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-[14px] text-ink-soft hover:border-ink-faint hover:text-ink"
              >
                Add up to 5 images. Text inside them is read and checked too.
              </button>
            ) : (
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {images.map((img, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-line p-2.5">
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
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
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
