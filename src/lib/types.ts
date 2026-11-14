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
  /** demo brands that can't be deleted */
  protected?: boolean;
  /** link to the brand's guidelines document */
  guidelines_pdf?: string;
  /** a guidelines document visitors can import into the Rulebook in one click */
  import_sample?: { url: string; name: string; label: string };
  /** sample posts shown on the check page (the demo brand's samples are built in) */
  samples?: BrandSample[];
}

export interface BrandSample {
  id: string;
  label: string;
  hint: string;
  title: string;
  channel: Channel;
  post_type: string;
  product: string;
  partner: boolean;
  caption: string;
  images: { src: string; alt_text: string }[];
}

export interface GuidelineDoc {
  id: string;
  name: string;
  file_name: string;
  kind: "pdf" | "text" | "seed";
  status: "active" | "paused";
  created_by: string;
  created_at: string;
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
  /** "paused" is never stored: it marks approved rules whose rulebook is paused */
  status: "approved" | "draft" | "rejected" | "paused";
  version: number;
  /** the rulebook (guidelines document) this rule came from; null for rules added by hand */
  document_id?: string | null;
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
  /** a video frame: seconds from the start when this picture appears … */
  t?: number;
  /** … and until when the same picture and text stay on screen */
  t_end?: number;
}

/** A stretch of speech in a video: when it starts and ends (seconds) and what is said. */
export interface SpeechSegment {
  t: number;
  end: number;
  text: string;
}

/** A video post. The file itself is never uploaded: only its checked frames (in `images`) and this. */
export interface PostVideo {
  name: string;
  duration: number;
  transcript: SpeechSegment[];
  /** who wrote the transcript: the AI from the audio, the creator by hand, or nobody (no speech) */
  transcript_source: "ai" | "typed" | "none";
}

export interface PostInput {
  title?: string;
  channel: Channel;
  post_type: string;
  product: string;
  partner: boolean;
  caption: string;
  /** images of the post; a carousel's slides in order; or, for a video, its frames in time order */
  images: PostImage[];
  video?: PostVideo;
}

/** Where a problem is: the caption, one image (or carousel slide, or video frame), or what is said in a video. */
export type Location = "caption" | `image ${number}` | "speech";

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
