"use client";
// Rewrite a few words of text inside an image, in the browser: find the line with OCR, cover it with its own
// background colour, and draw the new words in the same place, size and colour.
// Made for small wording changes on flat-colour graphics. It refuses (with a reason) when the result would look wrong.
import type { ImageAnalysis } from "../types";
import { colourDistance, type RGB } from "../color";
import { findLineRun, replaceQuote, wrapIntoLines } from "../image-text";
import { analyzeImage, loadImage, ocrWorker, textColours, toCanvas } from "./analyze-image";

const FONT = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif';
const MAX_SIDE = 800; // the size images are saved at

export class ImageEditError extends Error {}

export interface ImageEdit {
  src: string;
  analysis: ImageAnalysis;
  before: string; // the line(s) as they were
  after: string; // the line(s) as drawn
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface OcrLine {
  text: string;
  bbox: Box;
}

const rgb = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;

/** Share of pixels in a rectangle that are close to a colour. */
function shareNear(ctx: CanvasRenderingContext2D, box: Box, colour: RGB, distance = 42): number {
  const x = Math.max(0, Math.floor(box.x0));
  const y = Math.max(0, Math.floor(box.y0));
  const w = Math.min(ctx.canvas.width - x, Math.ceil(box.x1 - box.x0));
  const h = Math.min(ctx.canvas.height - y, Math.ceil(box.y1 - box.y0));
  if (w <= 0 || h <= 0) return 1;
  const d = ctx.getImageData(x, y, w, h).data;
  let near = 0;
  let total = 0;
  for (let i = 0; i < d.length; i += 8) {
    total++;
    if (colourDistance([d[i], d[i + 1], d[i + 2]], colour) < distance) near++;
  }
  return total ? near / total : 1;
}

/** The band of pixels just outside a box: if it isn't one flat colour, painting over the text would show. */
function ringIsFlat(ctx: CanvasRenderingContext2D, box: Box, bg: RGB, pad: number): boolean {
  const t = Math.max(2, Math.round(pad / 2));
  const sides: Box[] = [
    { x0: box.x0 - pad - t, y0: box.y0 - pad - t, x1: box.x1 + pad + t, y1: box.y0 - pad },
    { x0: box.x0 - pad - t, y0: box.y1 + pad, x1: box.x1 + pad + t, y1: box.y1 + pad + t },
    { x0: box.x0 - pad - t, y0: box.y0 - pad, x1: box.x0 - pad, y1: box.y1 + pad },
    { x0: box.x1 + pad, y0: box.y0 - pad, x1: box.x1 + pad + t, y1: box.y1 + pad },
  ];
  return sides.every((s) => shareNear(ctx, s, bg, 30) >= 0.9);
}

/** How much of a box is text-coloured: used to tell bold lettering from regular. */
function inkShare(ctx: CanvasRenderingContext2D, box: Box, fg: RGB): number {
  return shareNear(ctx, box, fg, 70);
}

/**
 * Paints over a box with the background, blending each column from the colour just above the box to the colour
 * just below it, so a gentle gradient stays smooth. Pixels that aren't background (other text) are ignored.
 */
function cover(ctx: CanvasRenderingContext2D, box: Box, bg: RGB) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(box.x0));
  const x1 = Math.min(W, Math.ceil(box.x1));
  const y0 = Math.max(0, Math.floor(box.y0));
  const y1 = Math.min(H, Math.ceil(box.y1));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const top = y0 > 0 ? ctx.getImageData(x0, y0 - 1, w, 1).data : null;
  const bottom = y1 < H ? ctx.getImageData(x0, y1, w, 1).data : null;
  const edge = (row: Uint8ClampedArray | null, x: number): RGB => {
    if (!row) return bg;
    const c: RGB = [row[x * 4], row[x * 4 + 1], row[x * 4 + 2]];
    return colourDistance(c, bg) < 60 ? c : bg;
  };
  const out = ctx.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const a = edge(top, x);
    const b = edge(bottom, x);
    for (let y = 0; y < h; y++) {
      const t = (y + 0.5) / h;
      const i = (y * w + x) * 4;
      out.data[i] = a[0] + (b[0] - a[0]) * t;
      out.data[i + 1] = a[1] + (b[1] - a[1]) * t;
      out.data[i + 2] = a[2] + (b[2] - a[2]) * t;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, x0, y0);
}

function font(size: number, bold: boolean) {
  return `${bold ? 700 : 400} ${Math.round(size * 10) / 10}px ${FONT}`;
}

/** Font size whose letters are as tall as the text in the box, and whether it looks bold. */
function matchFont(ctx: CanvasRenderingContext2D, text: string, box: Box, fg: RGB): { size: number; bold: boolean; ascent: number; scaleX: number } {
  const h = box.y1 - box.y0;
  const w = box.x1 - box.x0;
  const pick = (bold: boolean) => {
    ctx.font = font(100, bold);
    const m = ctx.measureText(text);
    const tall = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 100;
    const size = (h / tall) * 100;
    ctx.font = font(size, bold);
    const m2 = ctx.measureText(text);
    return { size, bold, ascent: m2.actualBoundingBoxAscent, width: m2.width };
  };
  // compare the real text's ink with how much ink each weight would leave in the same box
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.ceil(w));
  off.height = Math.max(1, Math.ceil(h));
  const o = off.getContext("2d", { willReadFrequently: true })!;
  const realInk = inkShare(ctx, box, fg);
  let best = pick(true);
  let bestDiff = Infinity;
  for (const bold of [false, true]) {
    const f = pick(bold);
    o.clearRect(0, 0, off.width, off.height);
    o.fillStyle = "#fff";
    o.fillRect(0, 0, off.width, off.height);
    o.fillStyle = "#000";
    o.font = font(f.size, bold);
    o.save();
    o.scale(w / (f.width || w), 1);
    o.fillText(text, 0, f.ascent);
    o.restore();
    const diff = Math.abs(inkShare(o, { x0: 0, y0: 0, x1: off.width, y1: off.height }, [0, 0, 0]) - realInk);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return { size: best.size, bold: best.bold, ascent: best.ascent, scaleX: Math.min(1.25, Math.max(0.8, w / (best.width || w))) };
}

async function readLines(canvas: HTMLCanvasElement): Promise<OcrLine[]> {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const out: OcrLine[] = [];
  for (const block of data.blocks ?? [])
    for (const para of block.paragraphs)
      for (const line of para.lines) {
        const text = line.text.trim();
        if (text && /[\p{L}\p{N}]/u.test(text) && line.confidence >= 40) out.push({ text, bbox: line.bbox });
      }
  return out.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

/**
 * Replaces `quote` with `replacement` inside the image at `src`. Throws ImageEditError with a plain reason when
 * the text can't be found, the background isn't flat, or the new words don't fit.
 */
export async function rewriteImageText(src: string, quote: string, replacement: string, onStatus?: (s: string) => void): Promise<ImageEdit> {
  onStatus?.("Finding the text in the image…");
  const img = await loadImage(src);
  const canvas = toCanvas(img, MAX_SIDE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const lines = await readLines(canvas);
  const run = findLineRun(
    lines.map((l) => l.text),
    quote,
  );
  if (!run) throw new ImageEditError(`Couldn't find “${quote}” in the image. If the text was read wrongly, use Correct under the image, or change the image itself.`);

  const targets = lines.slice(run.start, run.end + 1);
  const before = targets.map((l) => l.text).join(" ");
  const newText = replaceQuote(before, quote, replacement.trim());
  if (newText === null) throw new ImageEditError(`Couldn't find “${quote}” in the image text.`);
  if (newText === before) throw new ImageEditError("The image already says that, so there is nothing to change.");

  // each line's colours, a flat background around it, and its font
  const W = canvas.width;
  const styled = targets.map((l, k) => {
    const colours = textColours(ctx, l.bbox);
    if (!colours) throw new ImageEditError("Couldn't tell the text colour from the background in this image.");
    const h = l.bbox.y1 - l.bbox.y0;
    // keep the cover inside the gap to the neighbouring lines
    const above = lines.filter((x) => x.bbox.y1 <= l.bbox.y0 && x !== l).map((x) => l.bbox.y0 - x.bbox.y1);
    const below = lines.filter((x) => x.bbox.y0 >= l.bbox.y1 && x !== l).map((x) => x.bbox.y0 - l.bbox.y1);
    const pad = Math.max(2, Math.min(Math.round(h * 0.22), ...above.map((g) => Math.floor(g / 2)), ...below.map((g) => Math.floor(g / 2))));
    if (!ringIsFlat(ctx, l.bbox, colours.bg, pad))
      throw new ImageEditError("The background behind this text isn't a single flat colour (for example a photo or a strong gradient), so a rewrite would show. Change it in your design tool instead.");
    const f = matchFont(ctx, l.text, l.bbox, colours.fg);
    const centre = (l.bbox.x0 + l.bbox.x1) / 2;
    const centred = Math.abs(centre - W / 2) < W * 0.04 && l.bbox.x0 > W * 0.12;
    return { line: l, k, ...colours, pad, ...f, centred };
  });

  // room for each new line: across to the image edge, keeping the same side margin
  const roomFor = (s: (typeof styled)[number]) => (s.centred ? W - 2 * Math.max(8, Math.min(s.line.bbox.x0, W - s.line.bbox.x1)) : W - s.line.bbox.x0 - Math.max(8, s.line.bbox.x0));
  // the same size if it fits, otherwise a little smaller (never below 80%)
  let wrapped: string[] | null = null;
  let scale = 1;
  for (const k of [1, 0.96, 0.92, 0.88, 0.84, 0.8]) {
    wrapped = newText
      ? wrapIntoLines(newText, styled.length, (i, text) => {
          const s = styled[i];
          ctx.font = font(s.size * k, s.bold);
          return ctx.measureText(text).width * s.scaleX <= roomFor(s);
        })
      : styled.map(() => "");
    if (wrapped) {
      scale = k;
      break;
    }
  }
  if (!wrapped) throw new ImageEditError("The new wording is too long to fit where the old text was. Shorten it, or change the image in your design tool.");

  // cover the old lines, check nothing else would be painted over, then draw the new ones
  for (const s of styled) cover(ctx, { x0: s.line.bbox.x0 - s.pad, y0: s.line.bbox.y0 - s.pad, x1: s.line.bbox.x1 + s.pad, y1: s.line.bbox.y1 + s.pad }, s.bg);
  styled.forEach((s, i) => {
    const text = wrapped![i];
    if (!text) return;
    const size = s.size * scale;
    ctx.font = font(size, s.bold);
    const width = ctx.measureText(text).width * s.scaleX;
    const x = s.centred ? (W - width) / 2 : s.line.bbox.x0;
    const area = { x0: x, y0: s.line.bbox.y0, x1: x + width, y1: s.line.bbox.y1 };
    if (shareNear(ctx, area, s.bg) < 0.9) throw new ImageEditError("The new wording would cover other parts of the image. Shorten it, or change the image in your design tool.");
    ctx.save();
    ctx.fillStyle = rgb(s.fg);
    ctx.translate(x, s.line.bbox.y0 + s.ascent * scale);
    ctx.scale(s.scaleX, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });

  const out = canvas.toDataURL("image/jpeg", 0.9);
  onStatus?.("Reading the new image…");
  const analysis = await analyzeImage(out);
  return { src: out, analysis, before, after: wrapped.filter(Boolean).join(" ") };
}
