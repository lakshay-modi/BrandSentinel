"use client";
// Reading a video in the browser. Nothing is uploaded: the browser itself plays the file, takes a frame every
// 2.5 seconds, reads the text in each frame (the same reader as for images) and pulls out the sound so the
// speech can be turned into text. Runs on the visitor's device, so it costs nothing.
import type { ImageAnalysis, PostImage } from "../types";
import { FRAME_EVERY_SECONDS, MAX_FRAMES, MAX_VIDEO_SECONDS } from "../video";
import { analyzeImage } from "./analyze-image";

export class VideoError extends Error {}

export interface VideoFrame extends PostImage {
  t: number;
  t_end: number;
  analysis: ImageAnalysis;
}

export interface VideoReading {
  name: string;
  duration: number;
  /** how many moments were looked at (one every 2.5 s) */
  sampled: number;
  /** the frames worth checking: each new on-screen text once, from when it was first seen (t) to when it was last seen (t_end) */
  frames: VideoFrame[];
  /** the sound as a 16 kHz mono WAV in base64, or null when the video has no sound or is silent */
  audio: string | null;
}

const MAX_BYTES = 150 * 1024 * 1024;

function once(target: EventTarget, ok: string, ms: number, what: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new VideoError(what)), ms);
    const onOk = () => done();
    const onErr = () => done(new VideoError("This browser can't play that video. Use an MP4 (H.264) or WebM file."));
    function done(err?: Error) {
      clearTimeout(timer);
      target.removeEventListener(ok, onOk);
      target.removeEventListener("error", onErr);
      if (err) reject(err);
      else resolve();
    }
    target.addEventListener(ok, onOk);
    target.addEventListener("error", onErr);
  });
}

/** A tiny greyscale thumbnail of a frame, to tell whether the picture changed since the last one. */
function signature(source: CanvasImageSource): Uint8Array {
  const c = document.createElement("canvas");
  c.width = 24;
  c.height = 24;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, 24, 24);
  const d = ctx.getImageData(0, 0, 24, 24).data;
  const out = new Uint8Array(24 * 24);
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  return out;
}

/** Average brightness difference between two thumbnails (0 = the same picture, 255 = black vs white). */
function difference(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

const sameWords = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, "") === b.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** A JPEG small enough that all frames together fit in one request. */
function frameJpeg(canvas: HTMLCanvasElement): string {
  const scale = Math.min(1, 640 / Math.max(canvas.width, canvas.height));
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  let out = c.toDataURL("image/jpeg", 0.72);
  for (const q of [0.6, 0.45, 0.3]) {
    if (out.length <= 140_000) break;
    out = c.toDataURL("image/jpeg", q);
  }
  return out;
}

function wavBase64(samples: Float32Array, rate: number): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // one channel
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The video's sound as a small WAV (16 kHz, one channel), or null if it has none or is silent. */
async function readAudio(file: File): Promise<string | null> {
  const Ctx: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || typeof OfflineAudioContext === "undefined") return null;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    const rate = 16_000;
    const frames = Math.min(Math.ceil(decoded.duration * rate), (MAX_VIDEO_SECONDS + 1) * rate);
    if (frames < rate / 2) return null;
    const off = new OfflineAudioContext(1, frames, rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    let energy = 0;
    for (let i = 0; i < mono.length; i += 8) energy += mono[i] * mono[i];
    if (Math.sqrt(energy / (mono.length / 8)) < 0.004) return null; // silence
    return wavBase64(mono, rate);
  } catch {
    return null; // no sound track, or a format the browser can't decode
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

/**
 * Reads a video file: checks its length, takes a frame every 2.5 seconds, reads the text in each new picture,
 * and pulls out the sound. Throws VideoError with a plain reason when the file can't be used.
 */
export async function readVideo(file: File, onStatus: (text: string) => void): Promise<VideoReading> {
  if (file.size > MAX_BYTES) throw new VideoError("That video is over 150 MB. Export a smaller version (for example 720p) and try again.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    onStatus("Opening the video…");
    video.src = url;
    await once(video, "loadedmetadata", 15_000, "The video took too long to open. Try a smaller file.");
    let duration = video.duration;
    if (!Number.isFinite(duration)) {
      // some recordings don't say how long they are until the player is sent to the end
      video.currentTime = 1e7;
      await once(video, "seeked", 8000, "Couldn't work out how long the video is. Export it again as MP4.").catch(() => undefined);
      duration = video.duration;
    }
    if (!Number.isFinite(duration) || duration <= 0) throw new VideoError("Couldn't work out how long the video is. Export it again as MP4.");
    if (duration > MAX_VIDEO_SECONDS + 0.5)
      throw new VideoError(`This video is ${Math.round(duration)} seconds long. Videos can be up to ${MAX_VIDEO_SECONDS} seconds: trim it and try again.`);
    if (!video.videoWidth) throw new VideoError("This file has no picture, only sound. Add a video file.");

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const times: number[] = [];
    for (let t = Math.min(0.3, duration / 2); t < duration - 0.05; t += FRAME_EVERY_SECONDS) times.push(Math.round(t * 10) / 10);
    const frames: VideoFrame[] = [];
    let lastSig: Uint8Array | null = null;

    for (const [i, t] of times.entries()) {
      onStatus(`Looking at the video: ${i + 1} of ${times.length} moments…`);
      video.currentTime = t;
      await once(video, "seeked", 6000, "The video stopped responding while it was being read. Try exporting it again as MP4.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const sig = signature(canvas);
      const last = frames.at(-1);
      // the same picture as a moment ago: nothing new to read
      if (last && lastSig && difference(sig, lastSig) < 4) {
        last.t_end = t;
        continue;
      }
      lastSig = sig;
      const analysis = await analyzeImage(canvas.toDataURL("image/jpeg", 0.92));
      // the same words as the frame before (the picture moved behind them): one problem, not one per frame
      if (last && analysis.ocr_text.trim() && sameWords(analysis.ocr_text, last.analysis.ocr_text)) {
        last.t_end = t;
        continue;
      }
      // a picture with no words has nothing to check; the first frame is kept as the cover
      if (!analysis.ocr_text.trim() && frames.length > 0) continue;
      if (frames.length >= MAX_FRAMES) continue;
      frames.push({ src: frameJpeg(canvas), alt_text: "", analysis, t, t_end: t });
    }

    onStatus("Listening for speech…");
    const audio = await readAudio(file);
    return { name: file.name, duration: Math.round(duration * 10) / 10, sampled: times.length, frames, audio };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

// The video file a creator added, kept for this visit only so the post page can play it and jump to a moment.
const players = new Map<string, string>();
let pending: string | null = null;

/** Remember the file just added on the check page … */
export function holdVideo(file: File) {
  if (pending) URL.revokeObjectURL(pending);
  pending = URL.createObjectURL(file);
}
/** … and tie it to the post once it has been saved. */
export function attachVideo(postId: string) {
  if (!pending) return;
  players.set(postId, pending);
  pending = null;
}
export function setPostVideo(postId: string, file: File) {
  const old = players.get(postId);
  if (old) URL.revokeObjectURL(old);
  players.set(postId, URL.createObjectURL(file));
}
export function postVideoUrl(postId: string): string | null {
  return players.get(postId) ?? null;
}
