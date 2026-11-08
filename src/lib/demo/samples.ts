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

/** What each sample post is there to show (its planted mistakes). */
export const SAMPLE_HINT: Record<string, string> = {
  P01: "Ranking, natural and green claims, pushy tone, a hard-to-read banner",
  P02: "Wrong city count, misspelled brand name, US spelling, too many emojis",
  P03: "Uses a festive offer that has already ended",
  P04: "Missing #ad, a weight-loss claim and food guilt",
  P05: "Diet claims the facts don't support, no allergen line",
  P06: "Greenwashing in both the caption and the image",
  P07: "Wrong calcium number and a comparison with dairy",
  P08: "Follows every rule, so it should pass cleanly",
  P09: "Off-brand colours and misspelled names inside the image",
  P10: "A valid offer with small formatting mistakes",
};

export function samplePosts(): SamplePost[] {
  return (postsJson as unknown as (Omit<SamplePost, "images"> & { images: { file: string; alt_text: string }[] })[]).map((p) => ({
    ...p,
    images: p.images.map((img) => ({ src: `/demo/${img.file.replace(/^images\//, "")}`, alt_text: img.alt_text })),
  }));
}
