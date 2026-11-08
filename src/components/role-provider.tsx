"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Role } from "@/lib/types";

export const ROLE_LABEL: Record<Role, string> = { creator: "Creator", brand_manager: "Brand manager", expert: "Expert reviewer" };
export const ROLE_HINT: Record<Role, string> = {
  creator: "Writes posts, fixes problems, submits for review",
  brand_manager: "Owns the rules, approves posts",
  expert: "Legal or product expert, signs off claims",
};
const DEFAULT_NAME: Record<Role, string> = { creator: "Priya", brand_manager: "Arjun", expert: "Meera" };

interface RoleState {
  role: Role;
  name: string;
  setRole: (r: Role) => void;
  setName: (n: string) => void;
}

const RoleContext = createContext<RoleState | null>(null);

// The chosen role and names are a per-visitor convenience kept in localStorage (the app works without it).
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable (private mode) */
  }
  listeners.forEach((l) => l());
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const storedRole = useSyncExternalStore(subscribe, () => read("bs-role"), () => null);
  const storedNames = useSyncExternalStore(subscribe, () => read("bs-names"), () => null);

  const role: Role = storedRole === "brand_manager" || storedRole === "expert" ? storedRole : "creator";
  let names = DEFAULT_NAME;
  try {
    if (storedNames) names = { ...DEFAULT_NAME, ...JSON.parse(storedNames) };
  } catch {
    /* ignore a bad stored value */
  }

  const value: RoleState = {
    role,
    name: names[role] || DEFAULT_NAME[role],
    setRole: (r) => write("bs-role", r),
    setName: (n) => write("bs-names", JSON.stringify({ ...names, [role]: n.slice(0, 40) })),
  };
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
