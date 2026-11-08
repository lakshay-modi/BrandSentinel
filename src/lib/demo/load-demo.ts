// Loads the Oatvia demo brand from /demo so tests (and the sample-post picker) use the same data as the database seed.
import brandJson from "../../../demo/brand.json";
import rulesJson from "../../../demo/rules.json";
import factsJson from "../../../demo/facts.json";
import analysisJson from "../../../demo/image_analysis.json";
import type { BrandSettings, Fact, ImageAnalysis, Rule } from "../types";
import { samplePosts as baseSamples, type SamplePost } from "./samples";

export type { SamplePost };

const STANDARD = new Set(["id", "category", "severity", "check", "scope", "rule", "guideline", "good", "bad"]);

export const demoBrand = brandJson as unknown as BrandSettings;

export const demoRules: Rule[] = (rulesJson as Record<string, unknown>[]).map((r) => ({
  id: r.id as string,
  category: r.category as Rule["category"],
  severity: r.severity as Rule["severity"],
  check_type: r.check as Rule["check_type"],
  scope: r.scope as string,
  rule: r.rule as string,
  guideline: r.guideline as string,
  good: r.good as string,
  bad: r.bad as string,
  params: Object.fromEntries(Object.entries(r).filter(([k]) => !STANDARD.has(k))),
  status: "approved",
  version: 1,
}));

export const demoFacts = factsJson as Fact[];

const analysis = analysisJson as Record<string, ImageAnalysis>;

/** Sample posts with the reference image analysis attached (what the browser analysis should produce). */
export function samplePosts(withAnalysis = false): SamplePost[] {
  return baseSamples().map((p) => ({
    ...p,
    images: p.images.map((img) => (withAnalysis ? { ...img, analysis: analysis[img.src.replace("/demo/", "")] } : img)),
  }));
}
