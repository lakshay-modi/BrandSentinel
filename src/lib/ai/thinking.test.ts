import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { callGemini, usesThinkingLevel } from "./gemini";

describe("Gemini thinking level", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("ASI1_API_KEY", "");
    vi.stubEnv("ASIAPI", "");
    vi.stubEnv("GEMINI_MODEL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is set only for Gemini 3 model names", () => {
    expect(usesThinkingLevel("gemini-3.8-flash")).toBe(true);
    expect(usesThinkingLevel("gemini-3-flash-preview")).toBe(true);
    expect(usesThinkingLevel("gemini-flash-lite-latest")).toBe(false);
    expect(usesThinkingLevel("gemini-2.5-flash")).toBe(false);
  });

  it("asks Gemini 3 Flash to think low, and asks again without it if the model refuses", async () => {
    const bodies: { model: string; thinking: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const model = url.split("/models/")[1].split(":")[0];
        const thinking = JSON.parse(String(init.body)).generationConfig.thinkingConfig ?? null;
        bodies.push({ model, thinking });
        if (thinking) return new Response("unsupported", { status: 400 });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
      }),
    );
    const res = await callGemini("sys", [{ text: "post" }]);
    expect(res).toMatchObject({ ok: true, model: "gemini-3.8-flash" });
    expect(bodies[0]).toEqual({ model: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } });
    expect(bodies[1]).toEqual({ model: "gemini-3.8-flash", thinking: null });
  });
});
