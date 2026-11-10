"use client";
import { useEffect, useSyncExternalStore } from "react";
import { api, type PostRow } from "./api";

import type { Role } from "../types";

export type QueueRow = PostRow & { latest: { score: number; band: string; problems: number } | null };

/** The selected brand's posts, shared by the Review queue and the badge in the menu. */
let state: { rows: QueueRow[] | null; error: string | null; at: number } = { rows: null, error: null, at: 0 };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshPosts(): Promise<void> {
  inflight ??= api
    .posts()
    .then((r) => {
      state = { rows: r.posts, error: null, at: Date.now() };
    })
    .catch((e: unknown) => {
      state = { ...state, error: e instanceof Error ? e.message : String(e) };
    })
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

/** Take a post out of the list at once (for example while it is being deleted). Returns a function that puts it back. */
export function removePost(id: string): () => void {
  const before = state;
  if (!state.rows) return () => {};
  state = { ...state, rows: state.rows.filter((r) => r.id !== id) };
  emit();
  return () => {
    state = before;
    emit();
  };
}

/** Forget the list (for example after switching brand) so the next view shows a fresh one. */
export function resetPosts() {
  state = { rows: null, error: null, at: 0 };
  emit();
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
