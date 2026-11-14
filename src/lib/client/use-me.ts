"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Role } from "../types";

/** Who the visitor is. Not signed in means the public demo, where the role can be switched on screen. */
export interface Me {
  signed_in: boolean;
  demo_account: boolean;
  name: string | null;
  email: string | null;
  /** null: signed in but not in any workspace yet */
  workspace: { id: string; name: string; isDemo: boolean } | null;
  /** "guest" may switch between the three roles */
  role: Role | "guest" | null;
  /** may act in any of the three roles: a brand manager covering for a small team */
  can_switch: boolean;
  workspaces: { id: string; name: string; is_demo: boolean; role: Role | "guest" }[];
}

const INITIAL: { me: Me | null; error: string | null } = { me: null, error: null };
let state = INITIAL;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function reloadMe(): Promise<void> {
  inflight ??= fetch("/api/me")
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't load your account");
      state = { me: data as Me, error: null };
    })
    .catch((e: unknown) => {
      state = { ...state, error: e instanceof Error ? e.message : String(e) };
    })
    .finally(() => {
      inflight = null;
      listeners.forEach((l) => l());
    });
  return inflight;
}

export function useMeState() {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  useEffect(() => {
    if (!state.me && !inflight) void reloadMe();
  }, []);
  return s;
}

export function useMe(): Me | null {
  return useMeState().me;
}

/**
 * After signing in or out, or changing workspace: load the app again from the start, so nothing from the
 * previous account (posts, rules, brand) is left on screen.
 */
export function restartApp(to = "/") {
  try {
    document.cookie = "bs-brand=; path=/; max-age=0; samesite=lax; secure";
  } catch {
    /* ignore */
  }
  window.location.assign(to);
}

const ACCOUNT_PAGES = ["/login", "/signup", "/join", "/welcome", "/reset"];

/** True on the sign-in, sign-up and invite pages, which work without a session. */
export function onAccountPage(): boolean {
  const path = window.location.pathname;
  return ACCOUNT_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** The session ran out (or nobody is signed in): go to the sign-in page and come back here afterwards. */
export function goToSignIn() {
  if (onAccountPage()) return;
  const here = window.location.pathname + window.location.search;
  window.location.replace(here === "/" ? "/login" : `/login?next=${encodeURIComponent(here)}`);
}

/** Where to go after signing in: the page the person was sent away from, if it is a page of this app. */
export function afterSignIn(fallback = "/"): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : fallback;
}
