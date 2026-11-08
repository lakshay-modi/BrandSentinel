"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type BrandData, type DecisionRow, type HistoryRow, type PostRow, type ReviewRow } from "@/lib/client/api";
import { applyFix, canApply } from "@/lib/fixes";

const endSentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
import type { Fact, Finding, Goal } from "@/lib/types";
import { FindingCard } from "./finding-card";
import { ProofText } from "./proof-text";
import { ScorePanel } from "./score-panel";
import { HistoryList, WorkflowPanel } from "./workflow-panel";
import { Button, CHANNEL_LABEL, ErrorNote, Panel, StatusTag } from "./ui";
import { useRole } from "./role-provider";

interface Data {
  post: PostRow;
  review: ReviewRow | null;
  decisions: DecisionRow[];
  history: HistoryRow[];
}

let brandCache: Promise<BrandData> | null = null;
function useBrand() {
  const [brand, setBrand] = useState<BrandData | null>(null);
  useEffect(() => {
    brandCache ??= api.brand();
    brandCache.then(setBrand).catch(() => (brandCache = null));
  }, []);
  return brand;
}

const AI_NOTE: Record<string, string> = {
  busy: "The AI checks are busy right now (free-tier limit), so this report has the fast checks only. Re-check in a minute to add the AI checks.",
  error: "The AI checks didn't finish this time, so this report has the fast checks only. Re-check to try again.",
  off: "AI checks are switched off on this server, so this report has the fast checks only.",
};

export function PostWorkspace() {
  const id = useSearchParams().get("id") ?? "";
  const { role, name } = useRole();
  const brand = useBrand();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [alts, setAlts] = useState<string[]>([]);
  const [ocr, setOcr] = useState<string[]>([]); // text read from each image; the creator can correct OCR mistakes
  const [ocrEdit, setOcrEdit] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [goalEdit, setGoalEdit] = useState<Goal | null>(null);

  const apply = useCallback((d: Data) => {
    setData(d);
    setCaption(d.post.caption);
    setAlts(d.post.images.map((i) => i.alt_text));
    setOcr(d.post.images.map((i) => i.analysis?.ocr_text ?? ""));
    setOcrEdit(null);
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

  const facts = useMemo(() => new Map<string, Fact>((brand?.facts ?? []).map((f) => [f.id, f])), [brand]);

  if (!id) return <ErrorNote>No post selected. Open a post from the review queue or check a new one.</ErrorNote>;
  if (error && !data) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <p className="text-sm text-ink-soft">Loading the post…</p>;

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
      ocr.some((t, i) => t !== (post.images[i]?.analysis?.ocr_text ?? "")));
  const goal: Goal | null = (post.goal && "message" in post.goal ? (post.goal as Goal) : null) ?? review?.goal ?? null;

  const pick = (fid: string) => {
    setPicked(fid);
    document.getElementById(`finding-${fid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setPicked(null), 1300);
  };

  const decide = async (f: Finding, action: DecisionRow["action"], reason?: string) => {
    if (!review) return;
    const { decision } = await api.decide(post.id, { review_id: review.id, finding_id: f.id, rule_id: f.rule_id, action, reason, role, actor: name });
    setData((d) => (d ? { ...d, decisions: [...d.decisions, decision] } : d));
  };

  const imageIndex = (f: Finding) => (f.location.startsWith("image") ? Number(f.location.split(" ")[1]) - 1 : -1);

  const accept = async (f: Finding) => {
    setError(null);
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
    await decide(f, "accept");
  };

  const edit = async (f: Finding, text: string) => {
    setError(null);
    if (f.rule_id === "READ-02" || f.fix.kind === "alt_text") {
      const i = imageIndex(f);
      setAlts((a) => a.map((v, j) => (j === i ? text : v)));
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
    await decide(f, "edit", text);
  };

  const recheck = async () => {
    setBusy("Re-checking…");
    setError(null);
    try {
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
          images: post.images.map((img, i) => ({
            ...img,
            alt_text: alts[i] ?? img.alt_text,
            analysis: img.analysis && { ...img.analysis, ocr_text: ocr[i] ?? img.analysis.ocr_text },
          })),
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const act = async (action: "submit" | "approve" | "request_changes", comment?: string) => {
    await api.act(post.id, { action, role, actor: name, comment });
    await load();
  };

  const confirmGoal = async (g: Goal) => {
    await api.act(post.id, { action: "confirm_goal", role, actor: name, goal: g });
    setGoalEdit(null);
    // refresh the post and history only: keep fixes the creator accepted but hasn't re-checked yet
    const d = await api.post(id);
    setData(d);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/queue" className="text-sm text-ink-soft hover:text-ink">
            ‹ Review queue
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{post.title || "Untitled post"}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {CHANNEL_LABEL[post.channel] ?? post.channel}, {post.post_type} post about {post.product || "the brand"}
            {post.partner ? ", paid partner" : ""}. By {post.created_by}.
          </p>
        </div>
        <StatusTag status={post.status} />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Left: the post itself */}
        <div className="space-y-4">
          <Panel title="Post as checked">
            {review ? (
              <ProofText text={review.caption} findings={numbered.filter((x) => x.f.location === "caption")} onPick={pick} />
            ) : (
              <p className="font-serif text-lg">{post.caption}</p>
            )}
            {post.images.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {post.images.map((img, i) => {
                  const refs = numbered.filter((x) => x.f.location === `image ${i + 1}`);
                  return (
                    <li key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={alts[i] || ""} className="aspect-square w-full rounded-md border border-line object-cover" />
                      {refs.length > 0 && (
                        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                          {refs.map((x) => (
                            <button
                              key={x.f.id}
                              type="button"
                              onClick={() => pick(x.f.id)}
                              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold text-white shadow ${x.f.severity === "high" ? "bg-high" : x.f.severity === "medium" ? "bg-med" : "bg-low"}`}
                              aria-label={`Problem ${x.ref}`}
                            >
                              {x.ref}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-ink-soft">
                        <span className="font-medium text-ink">Image {i + 1}.</span> {alts[i] ? `Alt text: ${alts[i]}` : "No alt text yet."}
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
                          <p className="text-xs text-ink-faint">
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
          </Panel>

          {canAct && (
            <Panel
              title="Edit the post"
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
                className="w-full rounded-md border border-line-strong px-3 py-2 font-serif text-[17px] leading-7"
                aria-label="Caption"
              />
              <p className="mt-2 text-xs text-ink-soft">
                {unsaved ? "You've made changes. Re-check to update the score and the findings." : "Accepted fixes appear here. Nothing changes without you."}
              </p>
              {review?.suggested_caption && review.suggested_caption !== caption && (
                <div className="mt-3 rounded-md border border-line bg-paper p-3">
                  <p className="text-xs font-semibold">AI-suggested version with all fixes (keeps your goal)</p>
                  <p className="mt-1 font-serif text-[15px] leading-6">{review.suggested_caption}</p>
                  <Button size="sm" className="mt-2" onClick={() => setCaption(review.suggested_caption!)}>
                    Use this version
                  </Button>
                </div>
              )}
            </Panel>
          )}

          <WorkflowPanel post={post} review={review} decisions={decisions} role={role} unsaved={unsaved} onAction={act} />
          <HistoryList history={history} />
        </div>

        {/* Right: the report */}
        <div className="space-y-4">
          {review ? (
            <>
              <Panel>
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

              <Panel title="Post goal" action={goal && !goalEdit && canAct && <Button size="sm" variant="ghost" onClick={() => setGoalEdit(goal)}>Edit</Button>}>
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

              <section aria-label="Problems found">
                <h2 className="mb-2 text-sm font-semibold">
                  {findings.length === 0 ? "No problems found" : `${findings.length} problem${findings.length > 1 ? "s" : ""} found`}
                </h2>
                {findings.length === 0 ? (
                  <p className="rounded-lg border border-pass/30 bg-pass-bg p-4 text-sm text-pass">This post follows every rule and every claim matches an approved fact.</p>
                ) : (
                  <ul className="space-y-3">
                    {numbered.map(({ f, ref }) => (
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
                        onEdit={(t) => edit(f, t)}
                        onDisagree={(r) => decide(f, "disagree", r)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {review.ask_human.length > 0 && (
                <Panel title="For a human to decide">
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
            <Panel>
              <p className="text-sm text-ink-soft">This post hasn&apos;t been checked yet.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
