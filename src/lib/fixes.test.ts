import { describe, expect, it } from "vitest";
import { applyFix } from "./fixes";

describe("applying fixes", () => {
  it("replaces text", () => {
    expect(applyFix("Our new chocolate flavor is a favorite", { kind: "replace", pairs: [{ from: "flavor", to: "flavour" }, { from: "favorite", to: "favourite" }] })).toBe(
      "Our new chocolate flavour is a favourite",
    );
  });
  it("removes text and tidies punctuation", () => {
    expect(applyFix("Meet ProBar: 20 g protein, vegan and tasty.", { kind: "remove", quotes: ["vegan and "] })).toBe("Meet ProBar: 20 g protein, tasty.");
    expect(applyFix("Light, eco-friendly, tasty", { kind: "remove", quotes: ["eco-friendly"] })).toBe("Light, tasty");
  });
  it("adds required text before trailing hashtags", () => {
    expect(applyFix("20% off with code OATVIA20 #OatviaEveryday #Snacks", { kind: "add_end", text: " T&C apply." })).toBe(
      "20% off with code OATVIA20. T&C apply. #OatviaEveryday #Snacks",
    );
  });
  it("adds a disclosure at the start once", () => {
    expect(applyFix("My snack", { kind: "add_start", text: "#ad " })).toBe("#ad My snack");
    expect(applyFix("#ad My snack", { kind: "add_start", text: "#ad " })).toBe("#ad My snack");
  });
  it("returns null when the text has already changed", () => {
    expect(applyFix("hello", { kind: "replace", pairs: [{ from: "bye", to: "x" }] })).toBeNull();
  });
});
