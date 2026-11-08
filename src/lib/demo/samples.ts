// The 10 sample posts from /demo, shaped for the "Try a sample post" picker.
import postsJson from "../../../demo/sample_posts.json";
import type { PostInput } from "../types";

export interface SamplePost extends PostInput {
  id: string;
  title: string;
}

export const SAMPLE_LABEL: Record<string, string> = {
  P01: "Launch post",
  P02: "LinkedIn update",
  P03: "Festive offer",
  P04: "Influencer post",
  P05: "Peanut Butter bar",
  P06: "Sustainability post",
  P07: "Oat milk post",
  P08: "Clean post",
  P09: "Off-brand image",
  P10: "Pack offer",
};

export function samplePosts(): SamplePost[] {
  return (postsJson as unknown as (Omit<SamplePost, "images"> & { images: { file: string; alt_text: string }[] })[]).map((p) => ({
    ...p,
    images: p.images.map((img) => ({ src: `/demo/${img.file.replace(/^images\//, "")}`, alt_text: img.alt_text })),
  }));
}
