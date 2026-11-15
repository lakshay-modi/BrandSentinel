"use client";
// Image analysis in the browser: read text (OCR), measure text contrast, find the main colours.
// Runs on the visitor's device, so it costs nothing and the image never needs an AI call for this part.
import type { ImageAnalysis } from "../types";
import { colourDistance, contrastRatio, rgbToHex, type RGB } from "../color";

const MAX_SIDE = 1080;

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image"));
    img.src = src;
  });
}

export function toCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Groups pixels into colour buckets and returns the biggest ones with their average colour. */
function colourBuckets(data: Uint8ClampedArray, step = 1): { rgb: RGB; count: number }[] {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    b.r += data[i];
    b.g += data[i + 1];
    b.b += data[i + 2];
    b.count++;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .map((b) => ({ rgb: [b.r / b.count, b.g / b.count, b.b / b.count] as RGB, count: b.count }))
    .sort((a, b) => b.count - a.count);
}

/** Merges near-identical buckets so anti-aliasing doesn't split one colour into many. */
function mergeClose(buckets: { rgb: RGB; count: number }[], distance = 28) {
  const out: { rgb: RGB; count: number }[] = [];
  for (const b of buckets) {
    const near = out.find((o) => colourDistance(o.rgb, b.rgb) < distance);
    if (near) near.count += b.count;
    else out.push({ ...b });
  }
  return out;
}

/** Text colour and background colour inside one text box: the two most common, clearly different colours. */
export function textColours(ctx: CanvasRenderingContext2D, box: { x0: number; y0: number; x1: number; y1: number }): { fg: RGB; bg: RGB } | null {
  const w = Math.max(1, box.x1 - box.x0);
  const h = Math.max(1, box.y1 - box.y0);
  const pad = Math.round(h * 0.15);
  const x = Math.max(0, box.x0 - pad);
  const y = Math.max(0, box.y0 - pad);
  const data = ctx.getImageData(x, y, Math.min(ctx.canvas.width - x, w + 2 * pad), Math.min(ctx.canvas.height - y, h + 2 * pad)).data;
  const merged = mergeClose(colourBuckets(data), 14);
  if (!merged.length) return null;
  const bg = merged[0].rgb;
  const total = merged.reduce((n, m) => n + m.count, 0);
  // usually the text colour is clearly different; when it isn't (dark grey on black, the very case contrast
  // checks exist for), take a close colour that still covers a real part of the box, not anti-aliasing
  const fg =
    merged.slice(1).find((m) => colourDistance(m.rgb, bg) > 60 && m.count > 20)?.rgb ??
    merged.slice(1).find((m) => colourDistance(m.rgb, bg) > 12 && m.count > total * 0.05)?.rgb;
  return fg ? { fg, bg } : null;
}

/**
 * A black-on-white copy of the image where each pixel is as dark as it is different from the background.
 * OCR misses pale text on a light background (or dark on dark), exactly the text a contrast check must find;
 * on this copy that text is dark and sharp. Same size as the original, so text boxes line up.
 */
export function separateFromBackground(ctx: CanvasRenderingContext2D, bg: RGB): HTMLCanvasElement {
  const { width, height } = ctx.canvas;
  const src = ctx.getImageData(0, 0, width, height).data;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const out = c.getContext("2d")!.createImageData(width, height);
  for (let i = 0; i < src.length; i += 4) {
    const d = Math.hypot(src[i] - bg[0], src[i + 1] - bg[1], src[i + 2] - bg[2]);
    const v = 255 - Math.min(255, d * 3);
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  c.getContext("2d")!.putImageData(out, 0, 0);
  return c;
}

const sameLine = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const y = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
export async function ocrWorker() {
  // The OCR engine and English language data are served from /public/tesseract, so OCR never depends on a CDN.
  if (!workerPromise)
    workerPromise = import("tesseract.js").then((t) =>
      t.createWorker("eng", 1, { workerPath: "/tesseract/worker.min.js", corePath: "/tesseract/core", langPath: "/tesseract/lang" }),
    );
  return workerPromise;
}

/**
 * Reads an image. `secondPass` decides when the low-contrast reading runs: always (images and slides), or only
 * when the first reading found nothing (video frames, where there can be many).
 */
export async function analyzeImage(src: string, onStatus?: (s: string) => void, secondPass: "always" | "if-empty" = "always"): Promise<ImageAnalysis> {
  const img = await loadImage(src);
  const canvas = toCanvas(img, MAX_SIDE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const total = canvas.width * canvas.height;

  // main colours (sample every 4th pixel for speed)
  const sampled = mergeClose(colourBuckets(ctx.getImageData(0, 0, canvas.width, canvas.height).data, 4));
  const sampledTotal = sampled.reduce((s, b) => s + b.count, 0) || 1;
  const dominant = sampled
    .slice(0, 5)
    .map((b) => ({ hex: rgbToHex(b.rgb), share: Math.round((b.count / sampledTotal) * 1000) / 1000 }))
    .filter((d) => d.share >= 0.02);

  // text: OCR, then contrast per line. Two passes: the image as it is, and a copy where text that is hard to
  // see (pale on light, dark on dark) is made dark, so low-contrast text is read and its contrast measured.
  onStatus?.("Reading text in the image…");
  const passes: { blocks: import("tesseract.js").Block[] | null; text: string }[] = [];
  try {
    const worker = await ocrWorker();
    passes.push((await worker.recognize(canvas, {}, { blocks: true, text: true })).data);
    const firstFound = (passes[0].blocks ?? []).some((b) => b.paragraphs.some((p) => p.lines.some((l) => l.confidence >= 40 && /[A-Za-z0-9]/.test(l.text))));
    if (sampled[0] && (secondPass === "always" || !firstFound)) passes.push((await worker.recognize(separateFromBackground(ctx, sampled[0].rgb), {}, { blocks: true, text: true })).data);
  } catch (e) {
    if (!passes.length) {
      workerPromise = null;
      return { ocr_text: "", lines: [], dominant, ocr_error: e instanceof Error ? e.message : String(e) };
    }
  }
  const lines: ImageAnalysis["lines"] = [];
  for (const data of passes)
    for (const block of data.blocks ?? [])
      for (const para of block.paragraphs)
        for (const line of para.lines) {
          const text = line.text.trim();
          if (!text || line.confidence < 40 || !/[A-Za-z0-9]/.test(text)) continue;
          if (lines.some((l) => sameLine(l.text, text))) continue;
          // colours always come from the original image
          const colours = textColours(ctx, line.bbox);
          if (!colours) continue;
          const height = line.bbox.y1 - line.bbox.y0;
          lines.push({
            text,
            contrast: Math.round(contrastRatio(colours.fg, colours.bg) * 100) / 100,
            fg: rgbToHex(colours.fg),
            bg: rgbToHex(colours.bg),
            large: height / canvas.height >= 0.035 || height >= 32,
          });
        }

  void total;
  return { ocr_text: lines.map((l) => l.text).join("\n") || passes[0]?.text.trim() || "", lines, dominant };
}

/** Downscaled JPEG data URL for saving with the post (keeps the database small). */
export async function shrinkImage(src: string, maxSide = 800): Promise<string> {
  const img = await loadImage(src);
  const canvas = toCanvas(img, maxSide);
  return canvas.toDataURL("image/jpeg", 0.85);
}
