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
    // the demo accounts' names
    expect(actorSchema.safeParse("Priya (demo)").success).toBe(true);
    expect(actorSchema.safeParse("Arjun (demo)").success).toBe(true);
    // markup is stripped, not passed through: no < > or = survive
    const cleaned = actorSchema.parse("<img src=x onerror=alert(1)>");
    expect(cleaned).not.toMatch(/[<>=]/);
    expect(actorSchema.parse("Dr. Meera, MD")).toBe("Dr. Meera MD");
    expect(actorSchema.parse("riya+test")).toBe("riya test");
    expect(actorSchema.parse("   ")).toBe("Guest");
    // tags are dropped whole, so their names don't end up in the person's name
    expect(actorSchema.parse("Zoë D'Souza <script>alert(1)</script>")).toBe("Zoë D'Souza alert(1)");
  });

  it("keeps workspace and brand names plain text", async () => {
    const { plainName } = await import("./schemas");
    const name = plainName(2, 80, "Give it a name");
    expect(name.parse("Kiro Bikes 🚲 <b>India</b>")).toBe("Kiro Bikes 🚲 India");
    expect(name.safeParse("<i></i>").success).toBe(false);
  });
});

describe("video posts: which video file a post may point to", () => {
  const base = { channel: "instagram", post_type: "launch", product: "", partner: false, caption: "Meet the new bar.", images: [{ src: "/demo/x.png", alt_text: "", t: 0.3 }] };
  const video = (extra: Record<string, unknown>) => ({ ...base, video: { name: "reel.mp4", duration: 25, transcript: [], transcript_source: "none", ...extra } });

  it("accepts the app's own sample reel as a public file", async () => {
    const { postInputSchema } = await import("./api");
    const parsed = postInputSchema.safeParse(video({ src: "/demo/video/oatvia-probar-reel.mp4" }));
    expect(parsed.success).toBe(true);
  });

  it("refuses any other address, so a post can't point players at an outside file", async () => {
    const { postInputSchema } = await import("./api");
    for (const src of ["https://evil.example/a.mp4", "/demo/video/../secret.mp4", "javascript:alert(1)"]) expect(postInputSchema.safeParse(video({ src })).success).toBe(false);
  });

  it("drops a stored flag sent by the browser: only the server marks a video as stored", async () => {
    const { postInputSchema } = await import("./api");
    const parsed = postInputSchema.safeParse(video({ stored: true }));
    expect(parsed.success && "stored" in (parsed.data.video ?? {})).toBe(false);
  });
});
