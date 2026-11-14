"use client";
// Small typed wrappers around the app's API routes.
import type { Brand, Fact, Goal, GuidelineDoc, PostInput, ReviewResult, Role, Rule } from "../types";

export interface ReviewRow extends ReviewResult {
  id: string;
  caption: string;
  created_at: string;
  dropped: number;
  redacted?: number;
  ai_detail?: string;
}

export interface PostRow {
  id: string;
  title: string;
  channel: PostInput["channel"];
  post_type: string;
  product: string;
  partner: boolean;
  caption: string;
  images: PostInput["images"];
  /** a video post: its length and speech transcript (its frames are in `images`) */
  video?: PostInput["video"] | null;
  goal: Goal | Record<string, never>;
  goal_confirmed: boolean;
  status: "draft" | "in_review" | "changes_requested" | "approved";
  assigned_role: "brand_manager" | "expert" | null;
  needs_expert: boolean;
  expert_approved: boolean;
  created_by: string;
  sample_id: string | null;
  /** a demo brand's sample post, shared by everyone, so it can't be deleted */
  demo?: boolean;
  updated_at: string;
}

export interface DecisionRow {
  id: string;
  review_id: string | null;
  finding_id: string;
  rule_id: string;
  action: "accept" | "edit" | "disagree";
  reason: string | null;
  role: Role;
  actor: string;
  created_at: string;
}

export interface HistoryRow {
  id: number;
  action: string;
  role: Role;
  actor: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface BrandData {
  brand: Brand;
  brands: { slug: string; name: string }[];
  documents: GuidelineDoc[];
  rules: Rule[];
  facts: Fact[];
  today: string;
  ai_enabled: boolean;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  brand: () => call<BrandData>("/api/brand"),
  review: (body: { post_id?: string; sample_id?: string; role: Role; actor: string; input: PostInput }) =>
    call<{ post_id: string; review: ReviewRow }>("/api/review", { method: "POST", body: JSON.stringify(body) }),
  posts: () => call<{ posts: (PostRow & { latest: { score: number; band: string; problems: number } | null })[] }>("/api/posts"),
  post: (id: string) =>
    call<{ post: PostRow; review: ReviewRow | null; decisions: DecisionRow[]; history: HistoryRow[]; brand: { slug: string; name: string }; facts: Fact[] }>(`/api/posts/${id}`),
  decide: (id: string, body: { review_id: string; finding_id: string; rule_id: string; action: DecisionRow["action"]; reason?: string; role: Role; actor: string }) =>
    call<{ decision: DecisionRow }>(`/api/posts/${id}/decision`, { method: "POST", body: JSON.stringify(body) }),
  act: (id: string, body: { action: "submit" | "approve" | "request_changes" | "confirm_goal"; role: Role; actor: string; comment?: string; goal?: Goal }) =>
    call<{ ok: boolean; assigned_role?: string; status?: string }>(`/api/posts/${id}/action`, { method: "POST", body: JSON.stringify(body) }),
};
