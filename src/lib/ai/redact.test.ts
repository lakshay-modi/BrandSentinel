import { describe, expect, it } from "vitest";
import { createRedactor, restore } from "./redact";

describe("redaction before the AI", () => {
  it("hides emails, phone numbers and confidential terms, keeping prices and nutrition numbers", () => {
    const r = createRedactor(["Project Harvest"]);
    const out = r.redact("DM priya.s@oatvia.in or call +91 98765 43210 about Project Harvest. ₹499 for 20 g protein, 2,000+ stores.");
    expect(out).toBe("DM [EMAIL 1] or call [PHONE 1] about [CONFIDENTIAL 1]. ₹499 for 20 g protein, 2,000+ stores.");
    expect(r.map.size).toBe(3);
  });

  it("uses the same placeholder for the same value and restores the AI answer", () => {
    const r = createRedactor();
    const a = r.redact("Mail hello@oatvia.in");
    const b = r.redact("hello@oatvia.in is our inbox");
    expect(a).toContain("[EMAIL 1]");
    expect(b).toContain("[EMAIL 1]");
    const back = restore({ suggested_caption: "Write to [EMAIL 1] today", findings: [{ quote: "Mail [EMAIL 1]" }] }, r.map);
    expect(back).toEqual({ suggested_caption: "Write to hello@oatvia.in today", findings: [{ quote: "Mail hello@oatvia.in" }] });
  });

  it("leaves normal post text unchanged", () => {
    const r = createRedactor();
    const text = "Stock up! ProBar 6-pack now just Rs. 499 with code OATVIA20, 20% off till 30 Nov. Valid on oatvia.in.";
    expect(r.redact(text)).toBe(text);
    expect(r.map.size).toBe(0);
  });
});
