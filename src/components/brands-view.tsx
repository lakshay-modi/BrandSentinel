"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { send } from "@/lib/client/send";
import { reloadBrand, switchBrand, useBrand } from "@/lib/client/use-brand";
import { resetPosts } from "@/lib/client/use-posts";
import { can } from "@/lib/roles";
import { Button, ConfirmDialog, Dialog, EmptyState, ErrorNote, PageSkeleton, Skeleton, timeAgo } from "./ui";
import { useRole } from "./role-provider";
import { RoleNote } from "./role-note";
import { useToast } from "./toast";
import { DemoReset } from "./demo-reset";

interface BrandRow {
  slug: string;
  name: string;
  tagline: string;
  palette: { hex: string; name: string }[];
  protected: boolean;
  created_at: string;
  last_activity: string | null;
  rules: number;
  drafts: number;
  facts: number;
  rulebooks: number;
  posts: number;
  waiting: number;
}

interface BrandDetails {
  name: string;
  tagline: string;
  products: string[];
  product_misspellings: string[];
  brand_hashtag: string;
  confidential_terms: string[];
  palette: { name: string; hex: string; use: string }[];
}

const BLANK: BrandDetails = { name: "", tagline: "", products: [], product_misspellings: [], brand_hashtag: "", confidential_terms: [], palette: [] };

/** A list of short words: type one and press Enter or comma. */
function TagInput({ value, onChange, placeholder, max = 20 }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p.slice(0, 60));
    onChange(next);
    setText("");
  };
  return (
    <div className="field mt-1 flex min-h-[42px] flex-wrap items-center gap-1.5 !py-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-paper py-0.5 pl-2 pr-1 text-[13px] font-medium">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded px-1 text-ink-faint hover:bg-line hover:text-ink">
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (text.trim()) add(text);
          } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-[14px] outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}

function BrandForm({ initial, submitLabel, onSave, onCancel }: { initial: BrandDetails; submitLabel: string; onSave: (b: BrandDetails) => Promise<void>; onCancel: () => void }) {
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BrandDetails>(k: K, v: BrandDetails[K]) => setB((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave({ ...b, brand_hashtag: b.brand_hashtag.trim() && !b.brand_hashtag.startsWith("#") ? `#${b.brand_hashtag.trim()}` : b.brand_hashtag.trim() });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
        <label className="block">
          <span className="field-label">Brand name</span>
          <input required minLength={2} maxLength={60} autoFocus value={b.name} onChange={(e) => set("name", e.target.value)} placeholder="For example: Voltaro Energy" className="field mt-1" />
        </label>
        <label className="block">
          <span className="field-label">Official hashtag</span>
          <input maxLength={40} value={b.brand_hashtag} onChange={(e) => set("brand_hashtag", e.target.value.replace(/\s/g, ""))} placeholder="#YourBrand" className="field mt-1" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">What the brand does</span>
        <input maxLength={120} value={b.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="One line, for example: Home solar batteries" className="field mt-1" />
      </label>
      <label className="block">
        <span className="field-label">Products</span>
        <TagInput value={b.products} onChange={(v) => set("products", v)} placeholder="Type a product name and press Enter" />
        <span className="field-hint">Offered when a creator writes a post, and used to match the right facts.</span>
      </label>
      <label className="block">
        <span className="field-label">Confidential names</span>
        <TagInput value={b.confidential_terms} onChange={(v) => set("confidential_terms", v)} placeholder="Internal project or partner names" />
        <span className="field-hint">Replaced with placeholders before any text is sent to the AI, and flagged if a post mentions them.</span>
      </label>
      <label className="block">
        <span className="field-label">Common misspellings of your names</span>
        <TagInput value={b.product_misspellings} onChange={(v) => set("product_misspellings", v)} placeholder="For example: VoltAro, Voltaroo" />
      </label>

      <fieldset>
        <legend className="field-label">Brand colours</legend>
        <ul className="mt-1.5 space-y-2">
          {b.palette.map((c, i) => (
            <li key={i} className="grid grid-cols-[42px_1fr_1fr_auto] items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"}
                onChange={(e) => set("palette", b.palette.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                aria-label={`Colour ${i + 1}`}
                className="h-[38px] w-[42px] cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
              />
              <input value={c.name} maxLength={40} required onChange={(e) => set("palette", b.palette.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" aria-label={`Colour ${i + 1} name`} className="field" />
              <input value={c.use} maxLength={80} onChange={(e) => set("palette", b.palette.map((x, j) => (j === i ? { ...x, use: e.target.value } : x)))} placeholder="Used for (optional)" aria-label={`Colour ${i + 1} use`} className="field" />
              <button type="button" onClick={() => set("palette", b.palette.filter((_, j) => j !== i))} aria-label={`Remove colour ${i + 1}`} className="rounded-lg px-2 py-1 text-[18px] text-ink-faint hover:bg-paper hover:text-high">
                ×
              </button>
            </li>
          ))}
        </ul>
        {b.palette.length < 8 && (
          <Button type="button" size="sm" className="mt-2" onClick={() => set("palette", [...b.palette, { name: "", hex: "#1F2A44", use: "" }])}>
            + Add a colour
          </Button>
        )}
      </fieldset>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy || b.name.trim().length < 2}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <span className="flex flex-col">
      <span className={`text-[18px] font-bold leading-tight tabular-nums ${tone ?? ""}`}>{n}</span>
      <span className="text-[12px] text-ink-faint">{label}</span>
    </span>
  );
}

/** Edit form that loads the brand's full details first. */
function EditBrand({ slug, onSaved, onCancel }: { slug: string; onSaved: (b: BrandDetails) => Promise<void>; onCancel: () => void }) {
  const [details, setDetails] = useState<BrandDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/brands/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load the brand");
        if (live) setDetails({ ...BLANK, ...d.brand });
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [slug]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!details)
    return (
      <div className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-24" />
      </div>
    );
  return <BrandForm initial={details} submitLabel="Save changes" onSave={onSaved} onCancel={onCancel} />;
}

export function BrandsView() {
  const { role, name } = useRole();
  const current = useBrand()?.brand.slug;
  const toast = useToast();
  const manage = can(role, "manage_brands");
  const [rows, setRows] = useState<BrandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [starter, setStarter] = useState(true);
  const [created, setCreated] = useState<{ slug: string; name: string } | null>(null);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);

  const load = () =>
    fetch("/api/brands")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load brands");
        setRows(d.brands);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void load();
  }, []);

  const work = async (b: { slug: string; name: string }) => {
    if (b.slug === current) return;
    toast(`Now working on ${b.name}.`, "info");
    await switchBrand(b.slug, resetPosts);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Brands</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            Each brand has its own rulebooks, Fact Bank and posts, kept fully apart. Pick the one to work on, or set up a new one from its guidelines.
          </p>
        </div>
        {manage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <span aria-hidden="true" className="text-[17px] leading-none">+</span> New brand
          </Button>
        )}
      </div>

      <RoleNote
        notes={{
          creator: "Pick the brand you're writing for. Only the brand manager can add, edit or delete brands.",
          expert: "Pick the brand whose claims you're reviewing. Only the brand manager can add, edit or delete brands.",
          brand_manager: "Add a brand, edit its details, or delete it with everything in it. The two demo brands can be edited but not deleted.",
        }}
      />

      {error && !rows && <ErrorNote>{error}</ErrorNote>}
      {!rows && !error && <PageSkeleton rows={3} />}
      {rows && rows.length === 0 && <EmptyState title="No brands yet">Create the first brand to start.</EmptyState>}
      {rows && rows.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => {
            const on = b.slug === current;
            return (
              <li key={b.slug} className={`row-in flex min-w-0 flex-col rounded-2xl border bg-surface p-5 ${on ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
                      <span className="truncate">{b.name}</span>
                      {b.protected && <span className="shrink-0 rounded-md bg-paper px-1.5 py-px text-[11px] font-semibold text-ink-soft">Demo</span>}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-soft">{b.tagline || "No description yet"}</p>
                  </div>
                  {on && <span className="shrink-0 rounded-full bg-pass-bg px-2 py-0.5 text-[11px] font-bold text-pass">Working on</span>}
                </div>
                {b.palette.length > 0 && (
                  <div className="mt-3 flex gap-1" aria-label="Brand colours">
                    {b.palette.map((c) => (
                      <span key={c.hex + c.name} title={`${c.name} ${c.hex}`} className="h-5 flex-1 rounded first:rounded-l-md last:rounded-r-md" style={{ background: c.hex }} />
                    ))}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Stat n={b.rules} label="rules in use" />
                  <Stat n={b.drafts} label="to review" tone={b.drafts ? "text-med" : ""} />
                  <Stat n={b.facts} label="facts" />
                  <Stat n={b.posts} label="posts" />
                </div>
                <p className="mt-3 text-[12px] text-ink-faint">
                  {b.rulebooks} rulebook{b.rulebooks === 1 ? "" : "s"}
                  {b.waiting > 0 && ` · ${b.waiting} waiting for review`}
                  {` · ${b.last_activity ? `active ${timeAgo(b.last_activity)}` : `created ${timeAgo(b.created_at)}`}`}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-line pt-3 [&]:mt-4">
                  {on ? (
                    <Link href="/rulebook" className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[13px] font-semibold text-white hover:bg-[#26304a]">
                      Open its Rulebook
                    </Link>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => work(b)}>
                      Work on this brand
                    </Button>
                  )}
                  {manage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                        Edit details
                      </Button>
                      {!b.protected && (
                        <Button size="sm" variant="ghost" className="!text-high hover:!bg-high-bg" onClick={() => setDeleting(b)}>
                          Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DemoReset always />

      <Dialog
        open={creating}
        onClose={() => {
          setCreating(false);
          setCreated(null);
        }}
        title={created ? `${created.name} is ready` : "New brand"}
        wide
      >
        {creating && !created && (
          <label className="mb-4 flex items-start gap-2.5 rounded-lg bg-paper px-3.5 py-2.5 text-[13px]">
            <input type="checkbox" className="mt-0.5 size-4" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
            <span>
              <span className="font-semibold">Start with the starter rules</span>
              <span className="block text-ink-soft">14 common rules (disclosure, rankings, capitals, hashtags, contrast, alt text and more), so checks work at once. You can edit, pause or remove them, and import your own guidelines on top.</span>
            </span>
          </label>
        )}
        {creating && !created && (
          <BrandForm
            initial={BLANK}
            submitLabel="Create brand"
            onCancel={() => setCreating(false)}
            onSave={async (b) => {
              const res = await send<{ brand: { slug: string; name: string } }>("/api/brands", "POST", { role, actor: name, brand: b, starter_rules: starter });
              setCreated(res.brand);
              await switchBrand(res.brand.slug, resetPosts);
              void load();
            }}
          />
        )}
        {created && (
          <div className="space-y-4 text-[14px]">
            <p className="text-ink-soft">You&apos;re now working on {created.name}. It starts empty; three steps get it checking posts:</p>
            <ol className="space-y-2">
              {[
                ["/rulebook", "Add a rulebook", "Upload the brand's guidelines PDF. The AI drafts rules; you approve them."],
                ["/facts", "Add facts", "The numbers and claims posts may use, each with a source and an end date."],
                ["/", "Check a post", "Switch to Creator and check a post against the new rules."],
              ].map(([href, t, d], i) => (
                <li key={href}>
                  <Link href={href} onClick={() => setCreating(false)} className="flex gap-3 rounded-xl border border-line p-3 hover:border-ink-faint hover:bg-paper/60">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">{i + 1}</span>
                    <span>
                      <span className="block font-semibold">{t}</span>
                      <span className="text-[13px] text-ink-soft">{d}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`} wide>
        {editing && (
          <EditBrand
            slug={editing.slug}
            onCancel={() => setEditing(null)}
            onSaved={async (b) => {
              await send(`/api/brands/${editing.slug}`, "PATCH", { role, actor: name, brand: b });
              setRows((rs) => rs?.map((r) => (r.slug === editing.slug ? { ...r, name: b.name, tagline: b.tagline, palette: b.palette } : r)) ?? rs);
              if (editing.slug === current) void reloadBrand();
              setEditing(null);
              toast(`${b.name} saved.`);
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        confirmText={deleting?.name}
        title={`Delete ${deleting?.name}?`}
        action="Delete brand"
        onConfirm={async () => {
          const b = deleting;
          if (!b) return;
          try {
            await send(`/api/brands/${b.slug}`, "DELETE", { role, actor: name, confirm: b.name });
            setRows((rs) => rs?.filter((r) => r.slug !== b.slug) ?? rs);
            setDeleting(null);
            toast(`${b.name} and everything in it was deleted.`, "info");
            if (b.slug === current) await switchBrand("oatvia", resetPosts);
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "error");
          }
        }}
      >
        <p>
          This deletes its {deleting?.rulebooks ?? 0} rulebook{deleting?.rulebooks === 1 ? "" : "s"}, {deleting?.rules ?? 0} rules, {deleting?.facts ?? 0} facts and {deleting?.posts ?? 0} posts with their reports. It can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
