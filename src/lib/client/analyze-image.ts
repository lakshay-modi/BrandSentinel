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

function toCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
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
function textColours(ctx: CanvasRenderingContext2D, box: { x0: number; y0: number; x1: number; y1: number }): { fg: RGB; bg: RGB } | null {
  const w = Math.max(1, box.x1 - box.x0);
  const h = Math.max(1, box.y1 - box.y0);
  const pad = Math.round(h * 0.15);
  const x = Math.max(0, box.x0 - pad);
  const y = Math.max(0, box.y0 - pad);
  const data = ctx.getImageData(x, y, Math.min(ctx.canvas.width - x, w + 2 * pad), Math.min(ctx.canvas.height - y, h + 2 * pad)).data;
  const merged = mergeClose(colourBuckets(data));
  if (!merged.length) return null;
  const bg = merged[0].rgb;
  const fg = merged.slice(1).find((m) => colourDistance(m.rgb, bg) > 60 && m.count > 20)?.rgb;
  return fg ? { fg, bg } : null;
}

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
async function ocrWorker() {
  // The OCR engine and English language data are served from /public/tesseract, so OCR never depends on a CDN.
  if (!workerPromise)
    workerPromise = import("tesseract.js").then((t) =>
      t.createWorker("eng", 1, { workerPath: "/tesseract/worker.min.js", corePath: "/tesseract/core", langPath: "/tesseract/lang" }),
    );
  return workerPromise;
}

export async function analyzeImage(src: string, onStatus?: (s: string) => void): Promise<ImageAnalysis> {
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

  // text: OCR, then contrast per line
  onStatus?.("Reading text in the image…");
  let data: { blocks: import("tesseract.js").Block[] | null; text: string };
  try {
    const worker = await ocrWorker();
    data = (await worker.recognize(canvas, {}, { blocks: true, text: true })).data;
  } catch (e) {
    workerPromise = null;
    return { ocr_text: "", lines: [], dominant, ocr_error: e instanceof Error ? e.message : String(e) };
  }
  const lines: ImageAnalysis["lines"] = [];
  for (const block of data.blocks ?? [])
    for (const para of block.paragraphs)
      for (const line of para.lines) {
        const text = line.text.trim();
        if (!text || line.confidence < 40 || !/[A-Za-z0-9]/.test(text)) continue;
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
  return { ocr_text: lines.map((l) => l.text).join("\n") || data.text.trim(), lines, dominant };
}

/** Downscaled JPEG data URL for saving with the post (keeps the database small). */
export async function shrinkImage(src: string, maxSide = 800): Promise<string> {
  const img = await loadImage(src);
  const canvas = toCanvas(img, maxSide);
  return canvas.toDataURL("image/jpeg", 0.85);
}
