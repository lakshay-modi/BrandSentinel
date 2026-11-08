export type Severity = "high" | "medium" | "low";
export type Category = "tone" | "words" | "claims" | "visuals" | "readability";
export type CheckType = "code" | "ai" | "code+ai";
export type Role = "creator" | "brand_manager" | "expert";
export type Channel = "instagram" | "linkedin" | "x" | "website" | "email";

export interface PaletteColour {
  name: string;
  hex: string;
  use: string;
}

export interface BrandSettings {
  name: string;
  tagline?: string;
  palette: PaletteColour[];
  palette_tolerance: number;
  products: string[];
  product_misspellings: string[];
  brand_hashtag: string;
  /** internal names (projects, partners) that must never be sent to the AI */
  confidential_terms?: string[];
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  settings: BrandSettings;
  rulebook_version: number;
}

export interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  check_type: CheckType;
  scope: string;
  rule: string;
  guideline: string;
  good: string;
  bad: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
  status: "approved" | "draft" | "rejected";
  version: number;
  /** where an imported rule came from (file name and the sentence it was drafted from) */
  source?: string;
}

export interface Fact {
  id: string;
  product: string;
  fact: string;
  source: string;
  valid_until: string; // YYYY-MM-DD
  type: string;
}

/** Result of analysing one image in the browser (OCR + pixel maths). */
export interface ImageAnalysis {
  ocr_text: string;
  lines: { text: string; contrast: number; fg: string; bg: string; large: boolean }[];
  dominant: { hex: string; share: number }[]; // colours covering a big share of the image
  ocr_error?: string; // set when the text in the image couldn't be read
}

export interface PostImage {
  src: string; // URL or downscaled data URL
  alt_text: string;
  analysis?: ImageAnalysis;
}

export interface PostInput {
  title?: string;
  channel: Channel;
  post_type: string;
  product: string;
  partner: boolean;
  caption: string;
  images: PostImage[];
}

export type Location = "caption" | `image ${number}`;

export interface Finding {
  id: string; // stable within a review, e.g. "WORD-03:caption"
  rule_id: string;
  category: Category;
  severity: Severity;
  location: Location;
  quotes: string[]; // exact text found (empty for "something is missing")
  message: string; // plain-language explanation
  evidence: string; // the rule text or fact that proves it
  fact_ids: string[];
  fix: Fix;
  source: "code" | "ai" | "code+ai";
}

/**
 * How to fix a finding. Only "replace", "add_start", "add_end" and "remove" can be applied in one click;
 * "alt_text" fills the image description; "manual" is advice for the creator.
 */
export type Fix =
  | { kind: "replace"; pairs: { from: string; to: string }[] }
  | { kind: "add_start" | "add_end"; text: string }
  | { kind: "remove"; quotes: string[] }
  | { kind: "alt_text"; text: string }
  | { kind: "manual"; advice: string };

export interface AskHuman {
  quote: string;
  location: Location;
  note: string;
}

export interface Goal {
  post_type: string;
  message: string;
  call_to_action: string;
}

export interface ReviewResult {
  score: number;
  band: "green" | "amber" | "red";
  findings: Finding[];
  ask_human: AskHuman[];
  goal: Goal | null;
  suggested_caption: string | null;
  ai_status: "ok" | "busy" | "off" | "error";
  model: string | null;
  rulebook_version: number;
}

export const SEVERITY_POINTS: Record<Severity, number> = { high: 15, medium: 7, low: 3 };
