// Starter rules: common rules that fit most brands, so a new workspace's checks work from the first minute,
// before any guidelines are imported. All of them are fast checks in plain code (no AI needed).
// A brand manager can edit, pause or remove them like any other rulebook.
import type { SupabaseClient } from "@supabase/supabase-js";

interface StarterRule {
  id: string;
  category: "tone" | "words" | "claims" | "visuals" | "readability";
  severity: "high" | "medium" | "low";
  check_type: "code";
  scope: string;
  rule: string;
  guideline: string;
  good: string;
  bad: string;
  params: Record<string, unknown>;
}

export const STARTER_RULES: StarterRule[] = [
  {
    id: "CLAIM-01", category: "claims", severity: "high", check_type: "code", scope: "all",
    rule: "No rankings or superlatives without an approved fact.",
    guideline: "Claims like “No. 1” or “the best” need proof. Add the proof to the Fact Bank first, or describe the product instead.",
    good: "Made with 100% whole oats.", bad: "India's No. 1 snack bar.",
    params: { patterns: ["\\bno\\.?\\s?1\\b", "#1\\b", "\\bnumber one\\b", "\\bthe best\\b", "\\bbest\\s+in\\b", "\\bindia'?s favou?rite\\b", "\\bworld'?s (?:best|first|leading)\\b", "\\bmarket leader\\b", "\\bunbeatable\\b"] },
  },
  {
    id: "CLAIM-08", category: "claims", severity: "high", check_type: "code", scope: "partner and influencer posts",
    rule: "Paid or partner posts must start with #ad or 'Paid partnership'.",
    guideline: "Advertising rules require a clear disclosure at the start of a paid or partner post.",
    good: "#ad Trying the new range this week.", bad: "Loving this new range! (posted by a paid partner, no disclosure)",
    params: { starts_with: ["#ad", "paid partnership"] },
  },
  {
    id: "TONE-01", category: "tone", severity: "medium", check_type: "code", scope: "all",
    rule: "No pressure or urgency language.",
    guideline: "Don't push the reader with urgency. Say what is on offer and until when.",
    good: "Available this week in all stores.", bad: "Hurry, last chance, don't miss out!",
    params: { pressure_phrases: ["hurry", "last chance", "don't miss out", "dont miss out", "grab yours now", "limited time only", "before it's gone", "act fast", "act now", "only a few left"] },
  },
  {
    id: "TONE-02", category: "tone", severity: "low", check_type: "code", scope: "all (launch posts: up to 2)",
    rule: "At most one exclamation mark per post. Launch posts may use two.",
    guideline: "One exclamation mark is enough to show excitement.",
    good: "Our new flavour is here!", bad: "It's here!!! So good!!!",
    params: { max_exclamations: 1, max_exclamations_launch: 2 },
  },
  {
    id: "TONE-03", category: "tone", severity: "low", check_type: "code", scope: "all",
    rule: "No words in ALL CAPS, except approved acronyms and offer codes.",
    guideline: "Capitals read as shouting and are harder to read. Add acronyms you use to this rule's allowed list.",
    good: "New this week.", bad: "NEW this week. BUY today.",
    params: { allowed_caps: ["T&C"] },
  },
  {
    id: "TONE-05", category: "tone", severity: "low", check_type: "code", scope: "channel-specific",
    rule: "Emoji limit: LinkedIn 1, Instagram 3.",
    guideline: "A few emojis are friendly; many look like spam.",
    good: "Breakfast, sorted. 🥣", bad: "😍🔥🔥💯🙌 So good 😋😋",
    params: { max_emojis: { linkedin: 1, instagram: 3 } },
  },
  {
    id: "WORD-01", category: "words", severity: "medium", check_type: "code", scope: "all (caption and image text)",
    rule: "Product and brand names must be spelled exactly as approved.",
    guideline: "List the approved names and the common misspellings under Manage brands.",
    good: "The approved product name, exactly.", bad: "A misspelled or restyled product name.",
    params: {},
  },
  {
    id: "WORD-06", category: "words", severity: "low", check_type: "code", scope: "channel: Instagram",
    rule: "Instagram posts must include the brand hashtag.",
    guideline: "Set the brand hashtag under Manage brands. Without one, this rule does nothing.",
    good: "A caption ending with the brand hashtag.", bad: "An Instagram caption without it.",
    params: {},
  },
  {
    id: "WORD-07", category: "words", severity: "low", check_type: "code", scope: "all",
    rule: "At most 5 hashtags per post.",
    guideline: "A few relevant hashtags work better than a wall of them.",
    good: "#Breakfast #Oats", bad: "Ten or more hashtags in one caption.",
    params: {},
  },
  {
    id: "WORD-08", category: "words", severity: "high", check_type: "code", scope: "all",
    rule: "Never mention confidential internal names.",
    guideline: "List project and partner code names under Manage brands. They are also hidden from the AI.",
    good: "Something new is coming soon.", bad: "Project Falcon launches next month.",
    params: {},
  },
  {
    id: "READ-01", category: "readability", severity: "high", check_type: "code", scope: "images",
    rule: "Text contrast at least 4.5:1 (3:1 for large text).",
    guideline: "The WCAG AA standard, so text on images can be read by everyone.",
    good: "Dark text on a light background.", bad: "Pale yellow text on white.",
    params: { min_ratio: 4.5, min_ratio_large: 3 },
  },
  {
    id: "READ-02", category: "readability", severity: "medium", check_type: "code", scope: "images",
    rule: "Every image needs alt text.",
    guideline: "One sentence saying what the image shows, for people who use screen readers.",
    good: "Alt text: A bowl of oats with sliced banana on a wooden table.", bad: "An image with no description.",
    params: {},
  },
  {
    id: "READ-03", category: "readability", severity: "low", check_type: "code", scope: "all",
    rule: "Multi-word hashtags use CamelCase.",
    guideline: "Capital letters let screen readers read each word.",
    good: "#GoodOatsEveryDay", bad: "#goodoatseveryday",
    params: {},
  },
  {
    id: "VIS-01", category: "visuals", severity: "medium", check_type: "code", scope: "images",
    rule: "Main image colours must come from the brand palette.",
    guideline: "Set the brand colours under Manage brands. Without a palette, this rule does nothing.",
    good: "An image in the brand's colours.", bad: "A large block of an off-brand colour.",
    params: {},
  },
];

export const STARTER_RULEBOOK = "Starter rules";

/** Give a new brand the starter rulebook. Fails quietly: a brand without it still works, it just starts empty. */
export async function addStarterRules(client: SupabaseClient, brandId: string, createdBy: string): Promise<number> {
  const { data: doc, error } = await client
    .from("guideline_docs")
    .insert({ brand_id: brandId, name: STARTER_RULEBOOK, file_name: "", kind: "seed", status: "active", created_by: createdBy })
    .select("id")
    .single();
  if (error || !doc) {
    console.error("[starter-rules] could not create the starter rulebook", error?.message);
    return 0;
  }
  const rows = STARTER_RULES.map((r) => ({ ...r, brand_id: brandId, status: "approved", version: 1, source: "BrandSentinel starter rules", document_id: doc.id }));
  const { error: rErr } = await client.from("rules").insert(rows);
  if (rErr) {
    console.error("[starter-rules] could not add the starter rules", rErr.message);
    await client.from("guideline_docs").delete().eq("id", doc.id);
    return 0;
  }
  return rows.length;
}
