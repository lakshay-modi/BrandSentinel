"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrand } from "@/lib/client/use-brand";
import { deleteLater, refreshPosts } from "@/lib/client/use-posts";
import { useRouter } from "next/navigation";
import { api, type DecisionRow, type HistoryRow, type PostRow, type ReviewRow } from "@/lib/client/api";
import { applyFix, canApply } from "@/lib/fixes";

const endSentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
import type { Fact, Finding, Goal, ImageAnalysis } from "@/lib/types";
import { FindingCard } from "./finding-card";
import { ProofText } from "./proof-text";
import { ScorePanel } from "./score-panel";
import { HistoryList, WorkflowPanel } from "./workflow-panel";
import { Button, CHANNEL_LABEL, ErrorNote, Panel, Skeleton, StatusTag } from "./ui";
import { useToast } from "./toast";
import { useRole } from "./role-provider";

interface Data {
  post: PostRow;
  review: ReviewRow | null;
  decisions: DecisionRow[];
  history: HistoryRow[];
  /** the post's own brand and its facts */
  brand?: { slug: string; name: string };
  facts?: Fact[];
}


const AI_NOTE: Record<string, string> = {
  busy: "The AI checks are busy right now (free-tier limit), so this report has the fast checks only. Re-check in a minute to add the AI checks.",
  error: "The AI checks didn't finish this time, so this report has the fast checks only. Re-check to try again.",
  off: "AI checks are switched off on this server, so this report has the fast checks only.",
};

type Filter = "all" | "high" | "medium" | "low" | "caption" | "images";

function PostSkeleton() {
  return (
    <div role="status" aria-label="Loading the post" className="mx-auto w-full max-w-4xl space-y-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-[32rem] max-w-full" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

/** The approval stamp: who approved the post, and when. */
function ApprovedStamp({ history }: { history: HistoryRow[] }) {
  const h = [...history].reverse().find((x) => x.action === "approved");
  const when = h ? new Date(h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  return (
    <div aria-label={h ? `Approved by ${h.actor} on ${when}` : "Approved"} className="stamp pointer-events-none -mt-2 shrink-0 rounded-lg border-[3px] border-double border-pass bg-surface px-3 py-1.5 text-center text-pass">
      <p className="text-[20px] font-bold leading-none tracking-tight">Approved</p>
      {h && (
        <p className="mt-1 text-[12px] font-semibold leading-none">
          {h.actor}, {when}
        </p>
      )}
    </div>
  );
}

/** A decision shown before the server has saved it. */
function tempDecision(d: Omit<DecisionRow, "id" | "created_at">): DecisionRow {
  return { ...d, id: `tmp-${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString() };
}

export function PostWorkspace({ id }: { id: string }) {
  const { role, name } = useRole();
  const brand = useBrand();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [alts, setAlts] = useState<string[]>([]);
  const [ocr, setOcr] = useState<string[]>([]); // text read from each image; the creator can correct OCR mistakes
  const [ocrEdit, setOcrEdit] = useState<number | null>(null);
  // images whose text was rewritten here (not saved until the re-check), with what they were before
  const [imgEdits, setImgEdits] = useState<Record<number, { src: string; analysis: ImageAnalysis; prev: { src: string; ocr: string } }>>({});
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null); // problem pointed at by hover or keyboard
  const [filter, setFilter] = useState<Filter>("all");
  const [hideDone, setHideDone] = useState(false);
  const toast = useToast();
  // j / k move between the problems shown in the list (read from the page, so filters are respected)
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.key !== "j" && e.key !== "k")) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      const ids = [...document.querySelectorAll<HTMLElement>('li[id^="finding-"]')].map((el) => el.id.slice("finding-".length));
      if (!ids.length) return;
      e.preventDefault();
      const cur = activeRef.current;
      const i = cur ? ids.indexOf(cur) : -1;
      const next = ids[e.key === "j" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1)] ?? ids[0];
      setActive(next);
      document.getElementById(`finding-${next}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [goalEdit, setGoalEdit] = useState<Goal | null>(null);
  const router = useRouter();
  // decisions still on their way to the server; a re-check or a submit waits for them
  const pending = useRef(new Set<Promise<void>>());
  const settle = () => Promise.all([...pending.current]);

  const apply = useCallback((d: Data) => {
    setData(d);
    setCaption(d.post.caption);
    setAlts(d.post.images.map((i) => i.alt_text));
    setOcr(d.post.images.map((i) => i.analysis?.ocr_text ?? ""));
    setOcrEdit(null);
    setImgEdits({});
    setError(null);
  }, []);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .post(id)
      .then((d) => live && apply(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [id, apply]);

  const load = async () => apply(await api.post(id));

  // facts of the post's own brand (sent with the post), so proof shows even when another brand is selected
  const facts = useMemo(() => new Map<string, Fact>((data?.facts ?? brand?.facts ?? []).map((f) => [f.id, f])), [data, brand]);

  if (!id) return <ErrorNote>No post selected. Open a post from the review queue or check a new one.</ErrorNote>;
  if (error && !data) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PostSkeleton />;

  const { post, review, decisions, history } = data;
  const editable = post.status === "draft" || post.status === "changes_requested";
  const canAct = editable && role === "creator";
  const findings = review?.findings ?? [];
  const numbered = findings.map((f, i) => ({ f, ref: i + 1 }));
  const latestDecision = new Map<string, DecisionRow>();
  for (const d of decisions) if (d.review_id === review?.id) latestDecision.set(d.finding_id, d);
  const unsaved =
    !!review &&
    (caption !== review.caption ||
      alts.some((a, i) => a !== (post.images[i]?.alt_text ?? "")) ||
      ocr.some((t, i) => t !== (post.images[i]?.analysis?.ocr_text ?? "")) ||
      Object.keys(imgEdits).length > 0);
  const goal: Goal | null = (post.goal && "message" in post.goal ? (post.goal as Goal) : null) ?? review?.goal ?? null;

  const visible = numbered.filter(({ f }) => {
    if (hideDone && latestDecision.has(f.id)) return false;
    if (filter === "all") return true;
    if (filter === "caption") return f.location === "caption";
    if (filter === "images") return f.location !== "caption";
    return f.severity === filter;
  });
  const count = (fn: (f: Finding) => boolean) => findings.filter(fn).length;
  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: findings.length },
    { key: "high", label: "High", n: count((f) => f.severity === "high") },
    { key: "medium", label: "Medium", n: count((f) => f.severity === "medium") },
    { key: "low", label: "Low", n: count((f) => f.severity === "low") },
    { key: "caption", label: "Caption", n: count((f) => f.location === "caption") },
    { key: "images", label: "Images", n: count((f) => f.location !== "caption") },
  ];

  const pick = (fid: string) => {
    setPicked(fid);
    document.getElementById(`finding-${fid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setPicked(null), 1300);
  };

  // The decision shows at once; the server records it in the background and the change is undone if it refuses.
  const decide = async (f: Finding, action: DecisionRow["action"], reason?: string, undo?: () => void) => {
    if (!review) return;
    const temp = tempDecision({ review_id: review.id, finding_id: f.id, rule_id: f.rule_id, action, reason: reason ?? null, role, actor: name });
    setData((d) => (d ? { ...d, decisions: [...d.decisions, temp] } : d));
    let done!: () => void;
    const p = new Promise<void>((r) => (done = r));
    pending.current.add(p);
    try {
      const { decision } = await api.decide(post.id, { review_id: review.id, finding_id: f.id, rule_id: f.rule_id, action, reason, role, actor: name });
      setData((d) => (d ? { ...d, decisions: d.decisions.map((x) => (x.id === temp.id ? decision : x)) } : d));
    } catch (e) {
      setData((d) => (d ? { ...d, decisions: d.decisions.filter((x) => x.id !== temp.id) } : d));
      undo?.();
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      pending.current.delete(p);
      done();
    }
  };

  const imageIndex = (f: Finding) => (f.location.startsWith("image") ? Number(f.location.split(" ")[1]) - 1 : -1);

  const accept = async (f: Finding) => {
    setError(null);
    const before = { caption, alts };
    const undo = () => {
      setCaption(before.caption);
      setAlts(before.alts);
    };
    if (f.fix.kind === "alt_text") {
      const i = imageIndex(f);
      const text = f.fix.text;
      setAlts((a) => a.map((v, j) => (j === i ? text : v)));
    } else {
      const next = applyFix(caption, f.fix);
      if (next === null) {
        setError("That text has already changed. Edit the caption directly or re-check.");
        return;
      }
      setCaption(next);
    }
    toast(f.fix.kind === "alt_text" ? "Alt text added. Re-check to update the score." : "Fix accepted. Re-check to update the score.");
    void decide(f, "accept", undefined, undo);
  };

  const edit = async (f: Finding, text: string, where?: "start" | "end") => {
    setError(null);
    const before = { caption, alts };
    const undo = () => {
      setCaption(before.caption);
      setAlts(before.alts);
    };
    if (f.fix.kind === "alt_text" || (f.rule_id === "READ-02" && f.location !== "caption" && f.source !== "ai")) {
      const i = imageIndex(f);
      setAlts((a) => a.map((v, j) => (j === i ? text : v)));
    } else if (where && f.location === "caption") {
      // something was missing: add the creator's text at the start or the end
      const t = text.trim();
      setCaption(where === "start" ? `${t} ${caption.trimStart()}` : `${caption.trimEnd()} ${t}`);
    } else if (f.location === "caption" && f.quotes[0]) {
      const q = f.quotes[0];
      const i = caption.indexOf(q) >= 0 ? caption.indexOf(q) : caption.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) {
        setError("That text has already changed. Edit the caption directly.");
        return;
      }
      setCaption(caption.slice(0, i) + text + caption.slice(i + q.length));
    } else {
      setError("Text inside an image can't be edited here. Change the image and re-check.");
      return;
    }
    toast("Edit applied. Re-check to update the score.");
    void decide(f, "edit", text, undo);
  };

  // Rewrite a few words inside an image (accept the suggested wording, or the creator's own).
  // Throws a plain message when it can't, which the problem card shows.
  const imageFix = async (f: Finding, text: string, how: "accept" | "edit") => {
    const i = imageIndex(f);
    const img = post.images[i];
    const quote = f.quotes[0];
    if (!img || !quote) throw new Error("This problem doesn't quote text in the image, so there is nothing to rewrite.");
    setImgBusy(i);
    try {
      const { rewriteImageText } = await import("@/lib/client/image-text-fix");
      const current = imgEdits[i];
      const prevOcr = ocr[i] ?? "";
      const edit = await rewriteImageText(current?.src ?? img.src, quote, text);
      const prev = current?.prev ?? { src: img.src, ocr: prevOcr };
      setImgEdits((m) => ({ ...m, [i]: { src: edit.src, analysis: edit.analysis, prev } }));
      setOcr((o) => o.map((v, j) => (j === i ? edit.analysis.ocr_text : v)));
      toast(`Image ${i + 1} changed to “${edit.after || "(text removed)"}”. Look at it, then re-check.`);
      // if the server refuses the decision, put the image back as it was
      const undo = () => {
        setImgEdits((m) => {
          const n = { ...m };
          if (current) n[i] = current;
          else delete n[i];
          return n;
        });
        setOcr((o) => o.map((v, j) => (j === i ? prevOcr : v)));
      };
      void decide(f, how, how === "edit" ? text : undefined, undo);
    } finally {
      setImgBusy(null);
    }
  };
  const undoImage = (i: number) => {
    const e = imgEdits[i];
    setImgEdits((m) => {
      const n = { ...m };
      delete n[i];
      return n;
    });
    if (e) setOcr((o) => o.map((v, j) => (j === i ? e.prev.ocr : v)));
  };

  const recheck = async () => {
    setBusy("Re-checking…");
    setError(null);
    try {
      await settle();
      await api.review({
        post_id: post.id,
        role,
        actor: name,
        input: {
          title: post.title,
          channel: post.channel,
          post_type: post.post_type,
          product: post.product,
          partner: post.partner,
          caption,
          images: post.images.map((img, i) => {
            const e = imgEdits[i];
            const analysis = e?.analysis ?? img.analysis;
            return { ...img, src: e?.src ?? img.src, alt_text: alts[i] ?? img.alt_text, analysis: analysis && { ...analysis, ocr_text: ocr[i] ?? analysis.ocr_text } };
          }),
        },
      });
      await load();
      toast("Re-checked. The report is up to date.", "info");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const act = async (action: "submit" | "approve" | "request_changes", comment?: string) => {
    await settle();
    const res = await api.act(post.id, { action, role, actor: name, comment });
    // show the new state straight away; the history refreshes in the background
    setData((d) => {
      if (!d) return d;
      const p = d.post;
      const next =
        action === "submit"
          ? { ...p, status: "in_review" as const, assigned_role: (res.assigned_role as PostRow["assigned_role"]) ?? "brand_manager", needs_expert: res.assigned_role === "expert", expert_approved: false }
          : action === "request_changes"
            ? { ...p, status: "changes_requested" as const, assigned_role: null, expert_approved: false }
            : res.status === "approved"
              ? { ...p, status: "approved" as const, assigned_role: null }
              : { ...p, expert_approved: true, assigned_role: "brand_manager" as const };
      return { ...d, post: next };
    });
    void load().catch(() => {});
    void refreshPosts();
    if (action === "submit") toast(res.assigned_role === "expert" ? "Submitted. It goes to the expert reviewer first." : "Submitted to the brand manager.");
    else if (action === "request_changes") toast("Sent back to the creator with your comment.", "info");
    else toast(res.status === "approved" ? "Approved. Ready to publish." : "Claims approved. Sent to the brand manager.");
  };

  const confirmGoal = async (g: Goal) => {
    await api.act(post.id, { action: "confirm_goal", role, actor: name, goal: g });
    setGoalEdit(null);
    // refresh the post and history only: keep fixes the creator accepted but hasn't re-checked yet
    const d = await api.post(id);
    setData(d);
    toast("Goal confirmed. Every fix keeps it.");
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/queue" className="text-[13px] font-medium text-ink-soft hover:text-ink">
            ‹ Review queue
          </Link>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{post.title || "Untitled post"}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {CHANNEL_LABEL[post.channel] ?? post.channel} {post.post_type} post about {post.product || "the brand"}
            {post.partner ? ", paid partner" : ""}
            {data.brand ? ` for ${data.brand.name}` : ""}. Created by {post.created_by}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAct && (
            <Button
              size="sm"
              variant="ghost"
              className="!text-ink-soft hover:!bg-high-bg hover:!text-high"
              onClick={() => {
                // the queue shows the deleted post with an Undo button for 5 seconds
                const undo = deleteLater({ ...post, latest: null }, { role, actor: name }, (m) => toast(m, "error"));
                toast(`“${post.title || "Untitled post"}” deleted.`, "info", { action: { label: "Undo", onClick: undo } });
                router.push("/queue");
              }}
            >
              Delete draft
            </Button>
          )}
          <StatusTag status={post.status} />
        </div>
      </div>


      {error && <ErrorNote>{error}</ErrorNote>}

      {/* One column, top to bottom: the post, its score, the goal, the problems, editing, approval and history (order-*). */}
      <div className="flex flex-col gap-5">
        <div className="contents">
          <section aria-label="The post as checked" className="order-1 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-sheet)] sm:p-8">
            <div className="mb-3 flex items-start justify-between gap-4">
              <p className="text-[13px] font-medium text-ink-soft">{review ? "Caption as checked" : "Caption"}</p>
              {post.status === "approved" && <ApprovedStamp history={history} />}
            </div>
            {review ? (
              <ProofText text={review.caption} findings={numbered.filter((x) => x.f.location === "caption")} onPick={pick} activeId={active} onHover={setActive} />
            ) : (
              <p className="font-serif text-[22px] leading-[1.6]">{post.caption}</p>
            )}
            {post.images.length > 0 && (
              <ul className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6">
                {post.images.map((img, i) => {
                  const refs = numbered.filter((x) => x.f.location === `image ${i + 1}`);
                  return (
                    <li key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgEdits[i]?.src ?? img.src} alt={alts[i] || ""} className={`aspect-square w-full rounded-lg border object-cover ${imgEdits[i] ? "border-low ring-2 ring-low/30" : "border-line"} ${imgBusy === i ? "animate-pulse" : ""}`} />
                      {imgBusy === i && (
                        <span className="absolute inset-x-2 bottom-14 rounded-md bg-ink/85 px-2 py-1 text-center text-[12px] font-medium text-white" role="status">
                          Rewriting the text in this image…
                        </span>
                      )}
                      {imgEdits[i] && (
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 rounded-md bg-low-bg px-2 py-1 text-[12px] text-low">
                          <span className="font-semibold">Text changed here, not saved yet.</span>
                          <span>Re-check to save it.</span>
                          <button type="button" onClick={() => undoImage(i)} className="ml-auto font-semibold underline">
                            Undo
                          </button>
                        </p>
                      )}
                      {refs.length > 0 && (
                        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                          {refs.map((x) => (
                            <button
                              key={x.f.id}
                              type="button"
                              onClick={() => pick(x.f.id)}
                              onMouseEnter={() => setActive(x.f.id)}
                              onMouseLeave={() => setActive(null)}
                              className={`flex size-7 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-md ring-2 transition-transform ${active === x.f.id ? "scale-125 ring-ink" : "ring-white"} ${x.f.severity === "high" ? "bg-high" : x.f.severity === "medium" ? "bg-med" : "bg-low"}`}
                              aria-label={`Problem ${x.ref}`}
                            >
                              {x.ref}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-[13px] text-ink-soft">
                        <span className="font-semibold text-ink">Image {i + 1}.</span> {alts[i] ? `Alt text: ${alts[i]}` : "No alt text yet."}
                      </p>
                      {ocrEdit === i ? (
                        <label className="mt-1 block text-xs text-ink-soft">
                          Text in the image (fix any reading mistakes, then re-check)
                          <textarea
                            autoFocus
                            rows={3}
                            value={ocr[i] ?? ""}
                            onChange={(e) => setOcr((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
                            onBlur={() => setOcrEdit(null)}
                            className="mt-0.5 w-full rounded border border-line-strong px-2 py-1 text-xs text-ink"
                          />
                        </label>
                      ) : (
                        (ocr[i] || img.analysis) && (
                          <p className="mt-0.5 text-[13px] text-ink-faint">
                            {ocr[i] ? <>Text found in image: “{ocr[i].replace(/\n/g, " / ")}”</> : "No text found in this image."}
                            {canAct && img.analysis && (
                              <button type="button" onClick={() => setOcrEdit(i)} className="ml-1 underline hover:text-ink">
                                Correct
                              </button>
                            )}
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {canAct && (
            <Panel
              className="order-5"
              title="Edit and re-check"
              action={
                <Button size="sm" variant={unsaved ? "primary" : "secondary"} disabled={!!busy || !unsaved} onClick={recheck}>
                  {busy ?? "Re-check"}
                </Button>
              }
            >
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-line-strong px-3 py-2 font-serif text-[18px] leading-[1.6]"
                aria-label="Caption"
              />
              <p className="mt-2 text-xs text-ink-soft">
                {unsaved ? "You've made changes. Re-check to update the score and the findings." : "Accepted fixes appear here. Nothing changes without you."}
              </p>
              {review?.suggested_caption && review.suggested_caption !== caption && (
                <div className="mt-4 rounded-lg bg-paper p-4">
                  <p className="text-[13px] font-semibold">Suggested version with every fix applied</p>
                  <p className="mt-1 font-serif text-[17px] leading-[1.55]">{review.suggested_caption}</p>
                  <p className="mt-1 text-[12px] text-ink-faint">Written by AI to keep the post&apos;s goal. Check it before you use it.</p>
                  <Button size="sm" className="mt-2" onClick={() => setCaption(review.suggested_caption!)}>
                    Use this version
                  </Button>
                </div>
              )}
            </Panel>
          )}

          <WorkflowPanel className="order-6" post={post} review={review} decisions={decisions} role={role} unsaved={unsaved} onAction={act} />
          <HistoryList className="order-7" history={history} />
        </div>

        {/* The report */}
        <div className="contents">
          {review ? (
            <>
              <Panel className="order-2">
                <ScorePanel score={review.score} band={review.band} findings={findings} onPick={pick} />
                {review.ai_status !== "ok" && <p className="mt-3 rounded-md bg-med-bg px-3 py-2 text-sm text-med">{AI_NOTE[review.ai_status] ?? AI_NOTE.error}</p>}
                {(review.redacted ?? 0) > 0 && (
                  <p className="mt-3 text-xs text-ink-soft">
                    {review.redacted} personal or confidential detail{review.redacted === 1 ? " was" : "s were"} hidden from the AI (shown to it as placeholders like [EMAIL 1]).
                  </p>
                )}
                {review.ai_status === "ok" && review.dropped > 0 && (
                  <p className="mt-3 text-xs text-ink-soft">The proof check removed {review.dropped} AI suggestion{review.dropped > 1 ? "s" : ""} that didn&apos;t match a real rule, quote or fact.</p>
                )}
              </Panel>

              <Panel className="order-3" title="Post goal" action={goal && !goalEdit && canAct && <Button size="sm" variant="ghost" onClick={() => setGoalEdit(goal)}>Edit</Button>}>
                {goalEdit ? (
                  <form
                    className="space-y-2 text-sm"
                    onSubmit={(e) => {
                      e.preventDefault();
                      confirmGoal(goalEdit);
                    }}
                  >
                    {(["post_type", "message", "call_to_action"] as const).map((k) => (
                      <label key={k} className="block">
                        <span className="text-xs text-ink-soft">{k === "post_type" ? "Post type" : k === "message" ? "Main message" : "Call to action"}</span>
                        <input value={goalEdit[k]} onChange={(e) => setGoalEdit({ ...goalEdit, [k]: e.target.value })} className="mt-0.5 w-full rounded border border-line-strong px-2 py-1" />
                      </label>
                    ))}
                    <Button size="sm" variant="primary" type="submit">
                      Save goal
                    </Button>
                  </form>
                ) : goal ? (
                  <div className="text-sm">
                    <p>
                      <span className="text-ink-soft">This is a</span> <strong>{goal.post_type}</strong> <span className="text-ink-soft">post. Main message:</span> <strong>{endSentence(goal.message)}</strong>{" "}
                      {goal.call_to_action ? (
                        <>
                          <span className="text-ink-soft">Call to action:</span> <strong>{endSentence(goal.call_to_action)}</strong>
                        </>
                      ) : (
                        <span className="text-ink-soft">No call to action.</span>
                      )}
                    </p>
                    {post.goal_confirmed ? (
                      <p className="mt-2 text-xs text-pass">Confirmed. Every suggested fix keeps this goal.</p>
                    ) : canAct ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-ink-soft">Is that right?</span>
                        <Button size="sm" onClick={() => confirmGoal(goal)}>
                          Yes, confirm
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-ink-soft">
                    The AI hasn&apos;t read the goal yet.{" "}
                    {canAct && (
                      <button className="underline" onClick={() => setGoalEdit({ post_type: post.post_type, message: "", call_to_action: "" })}>
                        Write it yourself
                      </button>
                    )}
                  </p>
                )}
              </Panel>

              <section aria-labelledby="problems-title" className="order-4">
                <h2 id="problems-title" className="mb-2 px-1 text-[15px] font-semibold tracking-tight">
                  {findings.length === 0 ? "No problems found" : `${findings.length} problem${findings.length > 1 ? "s" : ""}, worst first`}
                </h2>
                {findings.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {FILTERS.filter((x) => x.key === "all" || x.n > 0).map((x) => (
                      <button
                        key={x.key}
                        type="button"
                        aria-pressed={filter === x.key}
                        onClick={() => setFilter(x.key)}
                        className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${filter === x.key ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink"}`}
                      >
                        {x.label} <span className={`tabular-nums ${filter === x.key ? "text-white/70" : "text-ink-faint"}`}>{x.n}</span>
                      </button>
                    ))}
                    {latestDecision.size > 0 && (
                      <label className="ml-1 flex items-center gap-1.5 text-[13px] text-ink-soft">
                        <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="size-3.5 accent-[var(--color-ink)]" />
                        Hide decided
                      </label>
                    )}
                    <span className="ml-auto hidden text-[12px] text-ink-faint xl:inline">
                      Press <kbd className="rounded border border-line-strong bg-surface px-1 font-sans">J</kbd> / <kbd className="rounded border border-line-strong bg-surface px-1 font-sans">K</kbd> to move between problems
                    </span>
                  </div>
                )}
                {findings.length === 0 ? (
                  <p className="rounded-xl border border-pass/30 bg-pass-bg p-5 text-[14px] text-pass">This post follows every rule, and every claim matches an approved fact.</p>
                ) : (
                  <ul className="overflow-hidden rounded-xl border border-line bg-surface">
                    {visible.length === 0 && <li className="px-5 py-6 text-center text-[14px] text-ink-soft">No problems match this filter.</li>}
                    {visible.map(({ f, ref }) => (
                      <FindingCard
                        key={f.id}
                        f={f}
                        n={ref}
                        facts={facts}
                        decision={latestDecision.get(f.id)}
                        canAct={canAct}
                        stale={f.location === "caption" && canApply(f.fix) && applyFix(caption, f.fix) === null}
                        highlighted={picked === f.id}
                        onAccept={() => accept(f)}
                        onEdit={(t, where) => edit(f, t, where)}
                        onImageFix={(t, how) => imageFix(f, t, how)}
                        onDisagree={async (r) => {
                          void decide(f, "disagree", r);
                          toast("Rejection saved. The reviewer will see your reason.", "info");
                        }}
                        active={active === f.id}
                        onHover={(on) => setActive(on ? f.id : null)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {review.ask_human.length > 0 && (
                <Panel className="order-4" title="For a human to decide">
                  <ul className="space-y-2 text-sm">
                    {review.ask_human.map((h, i) => (
                      <li key={i}>
                        {h.quote && <span className="font-serif">“{h.quote}”</span>} <span className="text-ink-soft">{h.note}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-faint">These are possible issues no rule clearly covers. They don&apos;t affect the score.</p>
                </Panel>
              )}
            </>
          ) : (
            <Panel className="order-2">
              <p className="text-sm text-ink-soft">This post hasn&apos;t been checked yet.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
