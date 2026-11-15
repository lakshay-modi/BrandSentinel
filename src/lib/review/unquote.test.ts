import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { unquote } = await import("./run-review");

describe("AI rewrite clean-up", () => {
  it("drops quote marks the AI wraps around the rewrite", () => {
    expect(unquote('"Mailchimp makes email marketing easy."', "MailChimp makes e-mail marketing easy.")).toBe("Mailchimp makes email marketing easy.");
    expect(unquote("“Turn ideas into emails and SMS that connect.”", "Turn ideas into emails & SMS that connect.")).toBe("Turn ideas into emails and SMS that connect.");
  });
  it("keeps quotes that belong to the caption, and plain text as it is", () => {
    expect(unquote('"Best day ever," said Priya.', '"Best day ever," said Priya!')).toBe('"Best day ever," said Priya.');
    expect(unquote("Plain rewrite.", "x")).toBe("Plain rewrite.");
    expect(unquote(null, "x")).toBe("");
  });
});
