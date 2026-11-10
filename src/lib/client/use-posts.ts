"use client";
import { useEffect, useSyncExternalStore } from "react";
import { api, type PostRow } from "./api";

import type { Role } from "../types";

export type QueueRow = PostRow & { latest: { score: number; band: string; problems: number } | null };

/** The selected brand's posts, shared by the Review queue and the badge in the menu. */
let state: { rows: QueueRow[] | null; error: string | null; at: number } = { rows: null, error: null, at: 0 };
let inflight: Promise<void> | null = null;
// bumped when the brand changes, so a list still loading for the old brand is thrown away
let generation = 0;
// drafts deleted with an Undo window, not yet sent to the server
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshPosts(): Promise<void> {
  if (inflight) return inflight;
  const gen = generation;
  const p: Promise<void> = api
    .posts()
    .then((r) => {
      if (gen !== generation) return;
      // drafts waiting to be deleted (the Undo window) stay hidden
      state = { rows: r.posts.filter((p) => !pending.has(p.id)), error: null, at: Date.now() };
    })
    .catch((e: unknown) => {
      if (gen === generation) state = { ...state, error: e instanceof Error ? e.message : String(e) };
    })
    .finally(() => {
      if (inflight === p) inflight = null;
      emit();
    });
  inflight = p;
  return p;
}

/** Take a post out of the list at once (for example while it is being deleted). Returns a function that puts it back. */
export function removePost(id: string): () => void {
  const rows = state.rows;
  const index = rows?.findIndex((r) => r.id === id) ?? -1;
  if (!rows || index < 0) return () => void refreshPosts();
  const row = rows[index];
  state = { ...state, rows: rows.filter((r) => r.id !== id) };
  emit();
  return () => {
    const now = state.rows ?? [];
    if (now.some((r) => r.id === id)) return;
    const next = [...now];
    next.splice(Math.min(index, next.length), 0, row);
    state = { ...state, rows: next };
    emit();
  };
}

/**
 * Delete a draft with a short chance to undo: it leaves the list at once, and the server is told only after
 * `delayMs` (or straight away if the page is closed first). Returns undo, which brings it back.
 */
export function deleteLater(row: QueueRow, body: { role: Role; actor: string }, onFail: (message: string) => void, delayMs = 5000): () => void {
  const restore = removePost(row.id);
  const send = () => {
    pending.delete(row.id);
    fetch(`/api/posts/${row.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `Couldn't delete the draft (${r.status})`);
      })
      .catch((e: unknown) => {
        restore();
        onFail(e instanceof Error ? e.message : String(e));
      });
  };
  pending.set(row.id, { timer: setTimeout(send, delayMs), send });
  return () => {
    const p = pending.get(row.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(row.id);
    restore();
  };
}
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    for (const p of [...pending.values()]) {
      clearTimeout(p.timer);
      p.send();
    }
  });

/** Forget the list (for example after switching brand) so the next view shows a fresh one. */
export function resetPosts() {
  generation++;
  inflight = null;
  state = { rows: null, error: null, at: 0 };
  emit();
  // load the new brand's list straight away (the menu badge and the queue both use it)
  void refreshPosts();
}

/** `maxAgeMs`: refetch on mount when the list is older than this (0 = always). */
export function usePosts(maxAgeMs = 20_000) {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!state.at || Date.now() - state.at > maxAgeMs) void refreshPosts();
  }, [maxAgeMs]);
  return s;
}

/** Posts that need this role to do something next. */
export function waitingFor(role: Role, p: QueueRow) {
  return role === "creator" ? p.status === "draft" || p.status === "changes_requested" : p.status === "in_review" && p.assigned_role === role;
}
