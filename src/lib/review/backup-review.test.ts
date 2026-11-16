import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// no database in tests: nothing is cached, and the test can see what would have been
const setCache = vi.fn(async () => undefined);
vi.mock("../db", async (orig) => ({ ...(await orig<typeof import("../db")>()), getCache: vi.fn(async () => null), setCache }));
const { runReview } = await import("./run-review");
const { STARTER_RULES } = await import("../starter-rules");
import type { Rule } from "../types";

const ctx = {
  brand: { id: "b1", slug: "kiro", name: "Kiro Bikes", rulebook_version: 1, settings: { name: "Kiro Bikes", palette: [], palette_tolerance: 40, products: ["Kiro One"], product_misspellings: [], brand_hashtag: "", confidential_terms: [] } },
  rules: STARTER_RULES.map((r) => ({ ...r, status: "approved", version: 1 }) as Rule),
  facts: [],
  documents: [],
} as unknown as Parameters<typeof runReview>[1];

// Gemini is busy; the backup answers with one finding of its own about words that really are in the post
function backupAnswers() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("api.asi1.ai")
        ? new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ findings: [{ rule_id: "CLAIM-04", location: "caption", quote: "Made for riders", message: "Implies a health benefit." }] }) } }] }), { status: 200 })
        : new Response("busy", { status: 429 }),
    ),
  );
}

describe("a check the backup AI answered", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setCache.mockClear();
  });

  it("shows the backup's own findings for a person to decide, keeps the fast checks, and caches nothing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "shared-gemini");
    vi.stubEnv("ASI1_API_KEY", "asi-key");
    backupAnswers();
    const out = await runReview({ channel: "instagram", post_type: "product", product: "Kiro One", partner: false, caption: "Made for riders. Hurry, last chance!", images: [] }, ctx, { origin: "https://x.test", clientId: "test-client" });
    expect(out.model).toBe("asi1");
    expect(out.findings.some((f) => f.source === "ai")).toBe(false);
    expect(out.findings.map((f) => f.rule_id)).toContain("TONE-01");
    expect(out.ask_human).toEqual([expect.objectContaining({ quote: "Made for riders", note: expect.stringContaining("backup AI") })]);
    expect(setCache).not.toHaveBeenCalled();
  });
});
