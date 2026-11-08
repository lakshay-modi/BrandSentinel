"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
    /* storage can be unavailable (private mode); the app still works */
  }
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("creator");
  const [names, setNames] = useState<Record<Role, string>>(DEFAULT_NAME);

  useEffect(() => {
    const r = read("bs-role");
    if (r === "creator" || r === "brand_manager" || r === "expert") setRoleState(r);
    const n = read("bs-names");
    if (n) {
      try {
        setNames({ ...DEFAULT_NAME, ...JSON.parse(n) });
      } catch {
        /* ignore bad stored value */
      }
    }
  }, []);

  const value: RoleState = {
    role,
    name: names[role],
    setRole: (r) => {
      setRoleState(r);
      write("bs-role", r);
    },
    setName: (n) => {
      const next = { ...names, [role]: n.slice(0, 40) || DEFAULT_NAME[role] };
      setNames(next);
      write("bs-names", JSON.stringify(next));
    },
  };
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
