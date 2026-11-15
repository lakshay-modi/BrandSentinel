import { beforeEach, describe, expect, it } from "vitest";
import { aiAllowance, resetAiLimits } from "./rate-limit";

describe("fair use of the shared AI", () => {
  beforeEach(() => resetAiLimits());

  it("lets one visitor run 8 AI checks a minute, then fast checks only", () => {
    const now = 1_000_000;
    const answers = Array.from({ length: 9 }, (_, i) => aiAllowance("judge-1", {}, now + i));
    expect(answers.slice(0, 8).every((a) => a === "ok" || a === "global")).toBe(true);
    expect(answers[8]).toBe("client");
    // a minute later they can check again
    expect(aiAllowance("judge-1", {}, now + 61_000)).not.toBe("client");
  });

  it("sends checks past the shared Gemini budget to the backup instead of refusing them", () => {
    const now = 2_000_000;
    const results = Array.from({ length: 14 }, (_, i) => aiAllowance(`judge-${i}`, {}, now + i));
    expect(results.slice(0, 12).every((a) => a === "ok")).toBe(true);
    expect(results.slice(12)).toEqual(["global", "global"]);
  });

  it("doesn't hold a company's own key to the shared budget", () => {
    const now = 3_000_000;
    for (let i = 0; i < 12; i++) aiAllowance(`judge-${i}`, {}, now + i);
    expect(aiAllowance("company-with-own-key", { sharedKey: false }, now + 20)).toBe("ok");
  });
});
