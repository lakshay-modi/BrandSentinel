"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { analyzeImage, shrinkImage } from "@/lib/client/analyze-image";
import { SAMPLE_LABEL, samplePosts, type SamplePost } from "@/lib/demo/samples";
import type { Channel, PostImage, PostInput } from "@/lib/types";
import { Button, ErrorNote } from "./ui";
import { useRole } from "./role-provider";

const POST_TYPES = ["product", "launch", "offer", "partner", "sustainability", "company update", "promo"];
const PRODUCTS = ["Oatvia ProBar", "ProBar Choco Almond", "ProBar Peanut Butter", "Oatvia Oat Milk", "Brand"];
const EMPTY: PostInput = { channel: "instagram", post_type: "product", product: "Oatvia ProBar", partner: false, caption: "", images: [] };

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
  const samples = samplePosts();

  const set = <K extends keyof PostInput>(k: K, v: PostInput[K]) => {
    setInput((p) => ({ ...p, [k]: v }));
    setSampleId(null);
  };

  function loadSample(s: SamplePost) {
    setInput({ title: s.title, channel: s.channel, post_type: s.post_type, product: s.product, partner: s.partner, caption: s.caption, images: [] });
    setImages(s.images.map((i) => ({ ...i, preview: i.src })));
    setSampleId(s.id);
    setError(null);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = 5 - images.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
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
      const res = await api.review({ sample_id: sampleId ?? undefined, role, actor: name, input: { ...input, images: prepared } });
      router.push(`/post?id=${res.post_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h1 className="text-xl font-semibold">Check a post before it goes live</h1>
          <p className="mt-1 text-sm text-ink-soft">Paste a caption and add images. BrandSentinel checks them against Oatvia&apos;s rules and approved facts, shows the proof for every problem, and suggests fixes.</p>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-medium">Try a sample post</p>
            <div className="flex flex-wrap gap-2">
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadSample(s)}
                  aria-pressed={sampleId === s.id}
                  title={s.title}
                  className={`rounded-full border px-3 py-1 text-sm ${sampleId === s.id ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:border-ink"}`}
                >
                  {SAMPLE_LABEL[s.id] ?? s.id}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Channel</span>
              <select value={input.channel} onChange={(e) => set("channel", e.target.value as Channel)} className="w-full rounded-md border border-line-strong bg-surface px-2 py-2">
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
                <option value="website">Website</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Post type</span>
              <select value={input.post_type} onChange={(e) => set("post_type", e.target.value)} className="w-full rounded-md border border-line-strong bg-surface px-2 py-2">
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Product</span>
              <select value={input.product} onChange={(e) => set("product", e.target.value)} className="w-full rounded-md border border-line-strong bg-surface px-2 py-2">
                {PRODUCTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={input.partner} onChange={(e) => set("partner", e.target.checked)} className="size-4" />
            Paid partner or influencer post
          </label>

          <label className="block text-sm">
            <span className="mb-1 flex justify-between font-medium">
              Caption <span className="font-normal text-ink-faint">{input.caption.length} / 3000</span>
            </span>
            <textarea
              value={input.caption}
              onChange={(e) => set("caption", e.target.value)}
              rows={6}
              maxLength={3000}
              placeholder="Write or paste the post text, including hashtags"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-serif text-[17px] leading-7"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Images ({images.length} / 5)</span>
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={images.length >= 5}>
                Add image
              </Button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            </div>
            {images.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-sm text-ink-faint">No images. Text inside images is read and checked too.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {images.map((img, i) => (
                  <li key={i} className="flex gap-3 rounded-md border border-line p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt={img.alt_text || `Image ${i + 1} preview`} className="size-20 shrink-0 rounded object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <label className="block">
                        <span className="text-xs text-ink-soft">Alt text (image description)</span>
                        <input
                          value={img.alt_text}
                          onChange={(e) => setImages((prev) => prev.map((p, j) => (j === i ? { ...p, alt_text: e.target.value } : p)))}
                          className="mt-0.5 w-full rounded border border-line-strong px-2 py-1"
                          placeholder="Describe the image"
                        />
                      </label>
                      <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="mt-1 text-xs text-ink-soft underline">
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={check} disabled={!!busy}>
              {busy ? "Checking…" : "Check post"}
            </Button>
            {busy && (
              <span className="text-sm text-ink-soft" aria-live="polite">
                {busy}
              </span>
            )}
          </div>
        </div>
      </section>

      <aside className="space-y-4 text-sm">
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="font-semibold">What gets checked</h2>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            <li><strong className="text-ink">Claims</strong> against the Fact Bank: numbers, rankings, health, diet and green claims, offers</li>
            <li><strong className="text-ink">Tone and words</strong>: pushy language, product names, spelling, banned words</li>
            <li><strong className="text-ink">Images</strong>: brand colours, text contrast, alt text, text inside the image</li>
          </ul>
        </section>
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="font-semibold">How it decides</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-ink-soft">
            <li>Fast checks in plain code find exact problems.</li>
            <li>The AI looks for reworded claims and tone problems.</li>
            <li>A proof check drops any AI finding that doesn&apos;t point to a real rule, quote and fact.</li>
            <li>You accept, edit or disagree with each fix. A person approves the post.</li>
          </ol>
        </section>
        <a href="/demo/Oatvia_Brand_Guidelines.pdf" target="_blank" className="block rounded-lg border border-line bg-surface p-4 hover:border-ink">
          <span className="font-semibold">Oatvia brand guidelines (PDF)</span>
          <span className="mt-1 block text-ink-soft">The source document the Rulebook was built from.</span>
        </a>
      </aside>
    </div>
  );
}
