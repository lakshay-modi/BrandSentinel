// Loads the Oatvia demo brand from /demo so tests (and the sample-post picker) use the same data as the database seed.
import brandJson from "../../../demo/brand.json";
import rulesJson from "../../../demo/rules.json";
import factsJson from "../../../demo/facts.json";
import postsJson from "../../../demo/sample_posts.json";
import analysisJson from "../../../demo/image_analysis.json";
import type { BrandSettings, Fact, ImageAnalysis, PostInput, Rule } from "../types";

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

export interface SamplePost extends PostInput {
  id: string;
  title: string;
}

const analysis = analysisJson as Record<string, ImageAnalysis>;

/** Sample posts with image paths pointing at /public/demo. `withAnalysis` attaches the reference image analysis (for tests). */
export function samplePosts(withAnalysis = false): SamplePost[] {
  return (postsJson as unknown as (Omit<SamplePost, "images"> & { images: { file: string; alt_text: string }[] })[]).map((p) => ({
    ...p,
    images: p.images.map((img) => {
      const name = img.file.replace(/^images\//, "");
      return { src: `/demo/${name}`, alt_text: img.alt_text, ...(withAnalysis ? { analysis: analysis[name] } : {}) };
    }),
  }));
}
