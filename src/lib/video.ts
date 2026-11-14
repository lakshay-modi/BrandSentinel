// Video posts. The video file never leaves the browser: it is sampled into frames (checked like images) and
// its speech is turned into text with timestamps (checked like a caption). These helpers are shared by the
// server and the screens.
import type { Finding, PostImage, PostInput, PostVideo, SpeechSegment } from "./types";

export const MAX_VIDEO_SECONDS = 60;
export const FRAME_EVERY_SECONDS = 2.5;
export const MAX_FRAMES = 24;
export const MAX_SLIDES = 10;

/** "0:07", "1:00" */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function isFrame(img: PostImage): boolean {
  return typeof img.t === "number";
}

/** Everything said in the video as one text, one segment per line. Problems are found in this text. */
export function speechText(video: PostVideo | null | undefined): string {
  return (video?.transcript ?? []).map((s) => s.text.trim()).filter(Boolean).join("\n");
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/** The moment a quote is said: the start of the segment that holds it (or holds its first words). */
export function speechTime(video: PostVideo | null | undefined, quote: string): number | null {
  const segs = (video?.transcript ?? []).filter((s) => s.text.trim());
  if (!segs.length) return null;
  const q = norm(quote);
  if (!q) return null;
  const direct = segs.find((s) => norm(s.text).includes(q));
  if (direct) return direct.t;
  // a quote that runs over two segments: find where it starts in the whole text
  let offset = 0;
  const starts = segs.map((s) => {
    const at = offset;
    offset += norm(s.text).length + 1;
    return at;
  });
  const i = segs.map((s) => norm(s.text)).join(" ").indexOf(q);
  if (i < 0) return null;
  let k = 0;
  while (k + 1 < starts.length && starts[k + 1] <= i) k++;
  return segs[k].t;
}

/** When a problem happens in the video, in seconds: the frame's time, or when the words are said. */
export function findingTime(f: Pick<Finding, "location" | "quotes">, post: Pick<PostInput, "images" | "video">): number | null {
  if (f.location === "speech") return f.quotes.length ? speechTime(post.video, f.quotes[0]) : null;
  const m = f.location.match(/^image (\d+)$/);
  if (!m) return null;
  const t = post.images[Number(m[1]) - 1]?.t;
  return typeof t === "number" ? t : null;
}

/** "in the caption", "on slide 3", "on screen at 0:12", "said at 0:31" */
export function whereLabel(f: Pick<Finding, "location" | "quotes">, post: Pick<PostInput, "images" | "video">): string {
  if (f.location === "caption") return "in the caption";
  if (f.location === "speech") {
    const t = findingTime(f, post);
    return t === null ? "in what is said" : `said at ${fmtTime(t)}`;
  }
  const n = Number(f.location.split(" ")[1]);
  const img = post.images[n - 1];
  if (img && isFrame(img)) return `on screen at ${fmtTime(img.t!)}`;
  return post.images.length > 1 ? `on slide ${n}` : "in the image";
}

/** Keeps a transcript tidy: in time order, inside the video, no empty lines. */
export function cleanTranscript(segments: SpeechSegment[], duration: number): SpeechSegment[] {
  return segments
    .map((s) => ({ t: Math.min(Math.max(0, s.t), duration), end: Math.min(Math.max(s.t, s.end), duration), text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((s) => s.text)
    .sort((a, b) => a.t - b.t);
}
