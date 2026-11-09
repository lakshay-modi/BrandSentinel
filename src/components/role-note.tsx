"use client";

import type { ReactNode } from "react";
import type { Role } from "@/lib/types";
import { ROLE_INFO } from "@/lib/roles";
import { useRole } from "./role-provider";

export const ROLE_DOT: Record<Role, string> = { creator: "bg-low", expert: "bg-med", brand_manager: "bg-pass" };

/** One line at the top of a page: what the current role does here. */
export function RoleNote({ notes }: { notes: Record<Role, ReactNode> }) {
  const { role } = useRole();
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
      <span className="mt-[3px] inline-flex shrink-0 items-center gap-1.5 rounded-md bg-paper px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-ink">
        <span className={`size-1.5 rounded-full ${ROLE_DOT[role]}`} aria-hidden="true" />
        {ROLE_INFO[role].short}
      </span>
      <span>{notes[role]}</span>
    </p>
  );
}
