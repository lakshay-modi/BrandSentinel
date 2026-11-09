import { describe, expect, it } from "vitest";
import { findLineRun, replaceQuote, wrapIntoLines } from "./image-text";

const LINES = ["Voltaro", "Voltaro Zip Pro", "Top speed 95 km/h", "5-year battery warranty", "#RideVoltaro"];

describe("rewriting text in an image", () => {
  it("finds the line a quote is on, ignoring case and punctuation", () => {
    expect(findLineRun(LINES, "top speed 95 km/h")).toEqual({ start: 2, end: 2 });
    expect(findLineRun(LINES, "95 km/h")).toEqual({ start: 2, end: 2 });
    expect(findLineRun(LINES, "5 year battery warranty")).toEqual({ start: 3, end: 3 });
  });
  it("finds a quote that runs over two lines", () => {
    expect(findLineRun(["Faster than Ather.", "India's No. 1", "electric scooter"], "India's No. 1 electric scooter")).toEqual({ start: 1, end: 2 });
  });
  it("returns null when the quote isn't there", () => {
    expect(findLineRun(LINES, "lifetime battery")).toBeNull();
  });
  it("swaps only the quoted words", () => {
    expect(replaceQuote("Top speed 95 km/h", "95 km/h", "85 km/h")).toBe("Top speed 85 km/h");
    expect(replaceQuote("Volt Aro Zip", "Volt Aro", "Voltaro")).toBe("Voltaro Zip");
    expect(replaceQuote("Faster than Ather.", "Faster than Ather.", "")).toBe("");
    expect(replaceQuote("Top speed 95 km/h", "120 km/h", "85 km/h")).toBeNull();
  });
  it("wraps new words back over the same lines, or says they don't fit", () => {
    const fits = (_: number, t: string) => t.length <= 16;
    expect(wrapIntoLines("A top choice for city rides", 2, fits)).toEqual(["A top choice for", "city rides"]);
    expect(wrapIntoLines("Top speed 85 km/h", 1, (_, t) => t.length <= 20)).toEqual(["Top speed 85 km/h"]);
    expect(wrapIntoLines("This sentence is much too long for one line", 1, fits)).toBeNull();
  });
});

describe("matching whole words first", () => {
  it("doesn't mistake a logo 'Voltaro' for the misspelling 'Volt Aro'", () => {
    expect(findLineRun(["Voltaro", "Volt Aro Zip", "Ride free:"], "Volt Aro")).toEqual({ start: 1, end: 1 });
    expect(replaceQuote("Volt Aro Zip", "Volt Aro", "Voltaro")).toBe("Voltaro Zip");
  });
  it("still copes with a space the image reader dropped", () => {
    expect(findLineRun(["TopSpeed 95 km/h"], "Top Speed 95 km/h")).toEqual({ start: 0, end: 0 });
  });
});
