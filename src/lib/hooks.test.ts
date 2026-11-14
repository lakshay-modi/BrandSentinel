import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createHmac } from "node:crypto";
import { checkHookUrl, isSlackHook, sign, slackText, webhookBody, type HookPost } from "./hooks";

const post: HookPost = { id: "p1", title: "Diwali offer <b>", channel: "instagram", status: "in_review", waiting_for: "expert", created_by: "Priya", brand: "Oatvia Foods", score: 79 };

describe("outgoing hooks", () => {
  it("accepts only public https addresses", async () => {
    const ok = async (u: string) => (await checkHookUrl(u, false)).ok;
    expect(await ok("https://hooks.example.com/brandsentinel")).toBe(true);
    expect(await ok("http://hooks.example.com/x")).toBe(false);
    expect(await ok("https://localhost/x")).toBe(false);
    expect(await ok("https://127.0.0.1/x")).toBe(false);
    expect(await ok("https://10.0.0.5/x")).toBe(false);
    expect(await ok("https://192.168.1.10/x")).toBe(false);
    expect(await ok("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(await ok("https://[::1]/x")).toBe(false);
    expect(await ok("https://[::ffff:10.0.0.1]/x")).toBe(false);
    expect(await ok("https://user:pass@example.com/x")).toBe(false);
    expect(await ok("https://example.com:8443/x")).toBe(false);
    expect(await ok("https://intranet/x")).toBe(false);
    expect(await ok("not a url")).toBe(false);
  });

  it("recognises Slack incoming webhook addresses only", () => {
    // a made-up address, put together from parts so it never looks like a real one in the repository
    const path = ["services", "T" + "0".repeat(8), "B" + "0".repeat(8), "X".repeat(24)].join("/");
    expect(isSlackHook(`https://hooks.slack.com/${path}`)).toBe(true);
    expect(isSlackHook(`https://hooks.slack.com.evil.example/${path}`)).toBe(false);
    expect(isSlackHook(`https://example.com/${path}`)).toBe(false);
  });

  it("signs the body so the receiver can verify it", () => {
    const body = webhookBody("post.approved", "Acme", { ...post, status: "approved" }, "https://app.example/posts/p1");
    expect(sign("whsec_test", body)).toBe(`sha256=${createHmac("sha256", "whsec_test").update(body).digest("hex")}`);
    const parsed = JSON.parse(body);
    expect(parsed.event).toBe("post.approved");
    expect(parsed.post).toMatchObject({ id: "p1", approved: true, status: "approved", url: "https://app.example/posts/p1" });
  });

  it("writes a Slack message that says who is needed, with a link and no raw angle brackets from the title", () => {
    const t = slackText("post.submitted", post, "https://app.example/posts/p1");
    expect(t).toContain("expert review");
    expect(t).toContain("<https://app.example/posts/p1|Diwali offer  b >");
    expect(t).toContain("score 79/100");
    expect(slackText("post.changes_requested", post, null)).toContain("Priya");
    expect(slackText("test", null, null)).toContain("test message");
  });
});
