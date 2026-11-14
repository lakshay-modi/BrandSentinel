import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { runCodeChecks } from "./checks/code-checks";
import { runVisualChecks } from "./checks/visual-checks";
import { demoBrand, demoFacts, demoRules } from "./demo/load-demo";
import { postInputSchema } from "./api";
import { proofCheck } from "./ai/proof";
import { buildUserPrompt } from "./ai/prompt";
import { cleanTranscript, findingTime, fmtTime, speechText, speechTime, whereLabel } from "./video";
import type { ImageAnalysis, PostInput, PostVideo } from "./types";

const rules = new Map(demoRules.map((r) => [r.id, r]));
const analysis = (text: string): ImageAnalysis => ({ ocr_text: text, lines: [], dominant: [{ hex: "#ff00ff", share: 0.9 }] });
const video: PostVideo = {
  name: "launch.mp4",
  duration: 20,
  transcript_source: "ai",
  transcript: [
    { t: 0.5, end: 3, text: "Meet the new Oatvia ProBar." },
    { t: 3.2, end: 7, text: "It is the best protein bar in India," },
    { t: 7, end: 10, text: "and it helps you lose weight fast." },
  ],
};
const post: PostInput = {
  channel: "instagram",
  post_type: "launch",
  product: "Oatvia ProBar",
  partner: false,
  caption: "Our new ProBar is here. #OatviaEveryday",
  images: [
    { src: "data:image/jpeg;base64,AAAA", alt_text: "", analysis: analysis("Oatvia ProBar"), t: 0.3, t_end: 5.3 },
    { src: "data:image/jpeg;base64,AAAA", alt_text: "", analysis: analysis("HURRY last chance"), t: 12.8, t_end: 17.8 },
  ],
  video,
};
const run = (input: PostInput) => [...runCodeChecks({ input, rules, facts: demoFacts, brand: demoBrand, today: "2026-11-14" }), ...runVisualChecks(input, rules, demoBrand)];

describe("video posts", () => {
  it("formats times and joins the speech", () => {
    expect(fmtTime(7.4)).toBe("0:07");
    expect(fmtTime(60)).toBe("1:00");
    expect(speechText(video).split("\n")).toHaveLength(3);
    expect(speechText(undefined)).toBe("");
  });

  it("finds the moment a quote is said, also when it runs over two lines", () => {
    expect(speechTime(video, "lose weight")).toBe(7);
    expect(speechTime(video, "best protein bar in India, and it helps")).toBe(3.2);
    expect(speechTime(video, "not said anywhere")).toBeNull();
  });

  it("checks what is said like a caption: a ranking and a health claim are caught in the speech", () => {
    const found = run(post);
    const said = found.filter((f) => f.location === "speech").map((f) => f.rule_id);
    expect(said).toEqual(expect.arrayContaining(["CLAIM-01", "CLAIM-04"]));
    const ranking = found.find((f) => f.location === "speech" && f.rule_id === "CLAIM-01")!;
    expect(findingTime(ranking, post)).toBe(3.2);
    expect(whereLabel(ranking, post)).toBe("said at 0:03");
  });

  it("checks on-screen text in a frame and links it to the frame's time", () => {
    const found = run(post);
    const pressure = found.find((f) => f.location === "image 2" && f.rule_id === "TONE-01");
    expect(pressure).toBeTruthy();
    expect(findingTime(pressure!, post)).toBe(12.8);
    expect(whereLabel(pressure!, post)).toBe("on screen at 0:13");
  });

  it("does not ask video frames for alt text or brand colours, and does not judge the transcript's spelling or capitals", () => {
    const found = run({ ...post, video: { ...video, transcript: [{ t: 0, end: 2, text: "The COLOR is great and it has 20g of protein" }] } });
    expect(found.filter((f) => f.location.startsWith("image") && (f.rule_id === "READ-02" || f.rule_id === "VIS-01"))).toEqual([]);
    expect(found.filter((f) => f.location === "speech" && ["TONE-03", "WORD-03", "WORD-05"].includes(f.rule_id))).toEqual([]);
  });

  it("names carousel slides and single images in words", () => {
    const carousel = { images: [{ src: "a", alt_text: "" }, { src: "b", alt_text: "" }] };
    expect(whereLabel({ location: "image 2", quotes: [] }, carousel)).toBe("on slide 2");
    expect(whereLabel({ location: "image 1", quotes: [] }, { images: [{ src: "a", alt_text: "" }] })).toBe("in the image");
    expect(whereLabel({ location: "caption", quotes: [] }, carousel)).toBe("in the caption");
  });

  it("tidies a transcript: in order, inside the video, no empty lines", () => {
    const out = cleanTranscript([{ t: 9, end: 99, text: " late " }, { t: 2, end: 1, text: "early" }, { t: 4, end: 5, text: "  " }], 10);
    expect(out).toEqual([{ t: 2, end: 2, text: "early" }, { t: 9, end: 10, text: "late" }]);
  });

  it("accepts a video post and a 10-slide carousel, and refuses frames without a video or more than 10 images", () => {
    const img = { src: "/demo/x.png", alt_text: "x" };
    expect(postInputSchema.safeParse(post).success).toBe(true);
    expect(postInputSchema.safeParse({ ...post, video: undefined, images: Array(10).fill(img) }).success).toBe(true);
    expect(postInputSchema.safeParse({ ...post, video: undefined, images: Array(11).fill(img) }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...post, video: undefined }).success).toBe(false);
    expect(postInputSchema.safeParse({ ...post, video: { ...video, duration: 75 } }).success).toBe(false);
  });

  it("proof check: an AI finding in the speech survives only if its quote is really said", () => {
    const ai = {
      goal: { post_type: "launch", message: "", call_to_action: "" },
      findings: [
        { rule_id: "CLAIM-07", location: "speech", quote: "the best protein bar in India", message: "Compares", fact_ids: [], fix: null, fix_advice: "" },
        { rule_id: "CLAIM-07", location: "speech", quote: "better than every other bar", message: "Invented", fact_ids: [], fix: null, fix_advice: "" },
      ],
      code_fixes: [],
      ask_human: [],
      alt_text: [],
      suggested_caption: "",
    };
    const out = proofCheck(ai as never, [], post, rules, demoFacts);
    expect(out.findings.map((f) => f.location)).toEqual(["speech"]);
    expect(out.dropped).toBe(1);
  });

  it("the AI is shown the speech, and a post without a video gets the same prompt as before", () => {
    const base = { brandName: "Oatvia", rules: demoRules, facts: demoFacts, codeFindings: [], today: "2026-11-14" };
    expect(buildUserPrompt({ ...base, input: post })).toContain("Speech (what is said in the video");
    const plain = buildUserPrompt({ ...base, input: { ...post, video: undefined, images: [] } });
    expect(plain).not.toContain("Speech");
    expect(plain).not.toContain("video");
  });
});

describe("notes for a human", () => {
  it("keeps only the AI's first sentence", async () => {
    const { brief } = await import("./ai/proof");
    expect(brief("Only 3 emojis are allowed. Wait, let's count: one, two. Actually no.")).toBe("Only 3 emojis are allowed.");
    expect(brief("x".repeat(400)).length).toBe(180);
  });
});
