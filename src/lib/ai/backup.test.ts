import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requestScope } from "../db";
import { backupAvailable, backupPrompt, callGemini, stripThinking } from "./gemini";

const GEMINI = "generativelanguage.googleapis.com";
const ASI = "api.asi1.ai";

function answer(url: string, gemini: number | "hang", asi: number | "timeout") {
  if (url.includes(GEMINI)) {
    return gemini === 200
      ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] } }] }), { status: 200 })
      : new Response("busy", { status: gemini as number });
  }
  if (asi === "timeout") return new Promise<Response>(() => undefined);
  return asi === 200
    ? new Response(JSON.stringify({ choices: [{ message: { content: '<think>checking {rules}</think>{"from":"asi1"}' } }] }), { status: 200 })
    : new Response("busy", { status: asi });
}

function mockFetch(gemini: number | "hang", asi: number | "timeout" = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url.includes(ASI) ? "asi1" : "gemini");
      if ((asi === "timeout" && url.includes(ASI)) || (gemini === "hang" && url.includes(GEMINI))) {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
      }
      return answer(url, gemini, asi);
    }),
  );
  return calls;
}

describe("backup AI", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "shared-gemini");
    vi.stubEnv("ASI1_API_KEY", "asi-key");
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("AI_BACKUP_FIRST", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is not used when Gemini answers", async () => {
    const calls = mockFetch(200);
    const res = await callGemini("sys", [{ text: "post" }]);
    expect(res).toMatchObject({ ok: true, text: '{"from":"gemini"}' });
    expect(calls).not.toContain("asi1");
  });

  it("answers when every Gemini model is out of free quota", async () => {
    const calls = mockFetch(429);
    const res = await callGemini("sys", [{ text: "post" }]);
    expect(res).toMatchObject({ ok: true, model: "asi1", text: '{"from":"asi1"}' });
    expect(calls.at(-1)).toBe("asi1");
  });

  it("starts while Gemini is still slow, and the first good answer wins", async () => {
    const calls = mockFetch("hang");
    const t0 = Date.now();
    const res = await callGemini("sys", [{ text: "post" }], 8000, { firstMs: 5000, laterMs: 5000 }, 300);
    expect(res).toMatchObject({ ok: true, model: "asi1" });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(calls).toContain("asi1");
  });

  it("reports busy when both are busy", async () => {
    mockFetch(429, 429);
    const res = await callGemini("sys", [{ text: "post" }]);
    expect(res).toMatchObject({ ok: false, status: "busy" });
  });

  it("stops at its time limit", async () => {
    mockFetch(429, "timeout");
    const t0 = Date.now();
    const res = await callGemini("sys", [{ text: "post" }], 6000, { firstMs: 1000, laterMs: 1000 }, 500);
    expect(res.ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(6500);
  }, 10000);

  it("is not used for speech to text (it can't hear audio)", async () => {
    const calls = mockFetch(429);
    const res = await callGemini("sys", [{ text: "listen" }, { image: { mimeType: "audio/wav", base64: "AAAA" } }]);
    expect(res.ok).toBe(false);
    expect(calls).not.toContain("asi1");
  });

  it("is never used for a workspace with its own Gemini key", async () => {
    const calls = mockFetch(429);
    const scope = { db: {} as never, workspaceId: "w1", aiKey: "company-own-key" };
    const res = await requestScope.run(scope, () => callGemini("sys", [{ text: "post" }]));
    expect(res.ok).toBe(false);
    expect(calls).not.toContain("asi1");
    expect(requestScope.run(scope, () => backupAvailable())).toBe(false);
  });

  it("is off without its key", () => {
    vi.stubEnv("ASI1_API_KEY", "");
    vi.stubEnv("ASIAPI", "");
    expect(backupAvailable()).toBe(false);
  });

  it("also takes its key under the name ASIAPI", () => {
    vi.stubEnv("ASI1_API_KEY", "");
    vi.stubEnv("ASIAPI", "asi-key");
    expect(backupAvailable()).toBe(true);
  });

  it("can be tried first for testing", async () => {
    vi.stubEnv("AI_BACKUP_FIRST", "1");
    const calls = mockFetch(200);
    const res = await callGemini("sys", [{ text: "post" }]);
    expect(res).toMatchObject({ ok: true, model: "asi1" });
    expect(calls).toEqual(["asi1"]);
  });

  it("when tried first and it fails, Gemini answers and the backup isn't asked twice", async () => {
    vi.stubEnv("AI_BACKUP_FIRST", "1");
    const calls = mockFetch(200, 500);
    const res = await callGemini("sys", [{ text: "post" }]);
    expect(res).toMatchObject({ ok: true, text: '{"from":"gemini"}' });
    expect(calls.filter((c) => c === "asi1")).toHaveLength(1);
  });

  it("gets the text only, and is told the images are missing", () => {
    const prompt = backupPrompt([{ text: "the post" }, { text: "Image 1:" }, { image: { mimeType: "image/png", base64: "AAAA" } }]);
    expect(prompt).toContain("the post");
    expect(prompt).not.toContain("Image 1:");
    expect(prompt).toContain("images themselves can't be shown");
    expect(backupPrompt([{ text: "only text" }])).toBe("only text");
  });

  it("keeps the answer, not the thinking", () => {
    expect(stripThinking('<think>a {b}</think>\n{"x":1}')).toBe('{"x":1}');
  });
});
