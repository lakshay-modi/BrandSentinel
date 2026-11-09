"use client";
import { useEffect, useSyncExternalStore } from "react";
import { api, type BrandData } from "./api";

/**
 * The current brand's rules, facts and rulebooks: fetched once and shared by every component.
 * Edits update this store first (so the screen changes at once) and roll back if the server says no.
 */
let state: { data: BrandData | null; error: string | null } = { data: null, error: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function reloadBrand(): Promise<void> {
  inflight = api
    .brand()
    .then((data) => {
      state = { data, error: null };
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

function ensureLoaded() {
  if (!state.data && !inflight) void reloadBrand();
}

/** Change the shared copy now. Returns a function that puts the old copy back. */
export function patchBrand(fn: (d: BrandData) => BrandData): () => void {
  const before = state.data;
  if (!before) return () => {};
  state = { ...state, data: fn(before) };
  emit();
  return () => {
    state = { ...state, data: before };
    emit();
  };
}

/**
 * Optimistic change: update the screen, send the request, undo the update if it fails.
 * `onError` gets the server's plain message.
 */
export async function optimistic<T>(fn: (d: BrandData) => BrandData, request: () => Promise<T>, onError: (message: string) => void): Promise<T | null> {
  const undo = patchBrand(fn);
  try {
    return await request();
  } catch (e) {
    undo();
    onError(e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Work on another brand: every page reads the new brand's rules, facts and posts without a page reload. */
export async function switchBrand(slug: string, onPosts?: () => void) {
  document.cookie = `bs-brand=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax; secure`;
  state = { data: null, error: null };
  emit();
  onPosts?.();
  await reloadBrand();
}

export function useBrandState() {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(ensureLoaded, []);
  return s;
}

export function useBrand(): BrandData | null {
  return useBrandState().data;
}
