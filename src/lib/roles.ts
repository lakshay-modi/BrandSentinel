// Who does what. One source for the server's permission checks and the app's role guide.
import type { Role } from "./types";

export type Permission =
  | "check_posts" // write, check, fix and submit posts
  | "decide_findings" // accept, edit or disagree with problems on your post
  | "approve_claims" // first approval of posts with claims or serious problems
  | "approve_posts" // final approval
  | "manage_facts" // add, edit and remove approved facts
  | "manage_rules" // import rulebooks, approve, edit, pause and remove rules
  | "manage_brands"; // create, edit and delete brands

const GRANTS: Record<Role, Permission[]> = {
  creator: ["check_posts", "decide_findings"],
  expert: ["approve_claims", "manage_facts"],
  brand_manager: ["approve_posts", "manage_facts", "manage_rules", "manage_brands"],
};

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

export const ROLE_INFO: Record<Role, { label: string; short: string; summary: string; does: string[]; doesNot: string[] }> = {
  creator: {
    label: "Creator",
    short: "Creator",
    summary: "Writes posts and fixes them before review.",
    does: ["Write a post and check it", "Accept, edit or disagree with each problem", "Re-check and submit for review", "Fix posts that are sent back", "Delete drafts they no longer need"],
    doesNot: ["Approve posts", "Change rules, facts or brands"],
  },
  expert: {
    label: "Expert reviewer",
    short: "Expert",
    summary: "Signs off claims and keeps the Fact Bank true.",
    does: ["Review posts with claims, serious problems or disputes", "Approve the claims or send the post back", "Add, correct and remove approved facts"],
    doesNot: ["Write posts", "Give final approval", "Change rules or brands"],
  },
  brand_manager: {
    label: "Brand manager",
    short: "Brand manager",
    summary: "Owns the brand: its rulebooks, facts and final approval.",
    does: ["Give final approval or send posts back", "Import rulebooks and approve, edit, pause or remove rules", "Manage facts", "Create, edit and delete brands", "Watch Insights for unclear rules"],
    doesNot: ["Write posts (the creator does)", "Skip the expert on risky posts"],
  },
};

export const ROLE_LABEL: Record<Role, string> = { creator: ROLE_INFO.creator.label, expert: ROLE_INFO.expert.label, brand_manager: ROLE_INFO.brand_manager.label };

/** "Only the brand manager can …" for an error message or a note. */
export function whoCan(permission: Permission): string {
  const roles = (Object.keys(GRANTS) as Role[]).filter((r) => GRANTS[r].includes(permission)).map((r) => `the ${ROLE_INFO[r].label.toLowerCase()}`);
  return roles.length === 1 ? roles[0] : `${roles.slice(0, -1).join(", ")} or ${roles.at(-1)}`;
}
