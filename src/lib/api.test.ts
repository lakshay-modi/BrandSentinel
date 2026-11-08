import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { postInputSchema, actorSchema } = await import("./api");

const base = { caption: "Hello", images: [] as object[] };

describe("input checks on the API", () => {
  it("accepts image data URLs and the bundled demo images only", () => {
    const ok = ["data:image/jpeg;base64,/9j/4AAQSkZJRg==", "/demo/p01_launch_banner.png"];
    const bad = ["https://evil.example/x.png", "javascript:alert(1)", "data:text/html;base64,PGgxPg==", "/demo/../.env", "//evil.example/a.png"];
    for (const src of ok) expect(postInputSchema.safeParse({ ...base, images: [{ src }] }).success).toBe(true);
    for (const src of bad) expect(postInputSchema.safeParse({ ...base, images: [{ src }] }).success).toBe(false);
  });

  it("rejects colour values that aren't hex", () => {
    const analysis = { ocr_text: "x", lines: [{ text: "x", contrast: 2, fg: "red;}", bg: "#FFFFFF", large: true }], dominant: [] };
    expect(postInputSchema.safeParse({ ...base, images: [{ src: "/demo/p08_clean.png", analysis }] }).success).toBe(false);
  });

  it("allows real names and blocks markup in the display name", () => {
    expect(actorSchema.safeParse("Priya S.").success).toBe(true);
    expect(actorSchema.safeParse("Zoë O'Neil-Rao").success).toBe(true);
    expect(actorSchema.safeParse("<img src=x onerror=alert(1)>").success).toBe(false);
  });
});
