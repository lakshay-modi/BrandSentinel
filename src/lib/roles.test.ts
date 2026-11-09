import { describe, expect, it } from "vitest";
import { can, ROLE_INFO, whoCan } from "./roles";
import { slugify } from "./schemas";

describe("who does what", () => {
  it("only the creator writes and checks posts", () => {
    expect(can("creator", "check_posts")).toBe(true);
    expect(can("expert", "check_posts")).toBe(false);
    expect(can("brand_manager", "check_posts")).toBe(false);
  });
  it("only the brand manager changes rules and brands", () => {
    for (const p of ["manage_rules", "manage_brands"] as const) {
      expect(can("brand_manager", p)).toBe(true);
      expect(can("creator", p)).toBe(false);
      expect(can("expert", p)).toBe(false);
    }
  });
  it("the expert and the brand manager keep the Fact Bank; the creator can't", () => {
    expect(can("expert", "manage_facts")).toBe(true);
    expect(can("brand_manager", "manage_facts")).toBe(true);
    expect(can("creator", "manage_facts")).toBe(false);
  });
  it("names who can do something, for error messages", () => {
    expect(whoCan("manage_rules")).toBe("the brand manager");
    expect(whoCan("manage_facts")).toBe("the expert reviewer or the brand manager");
  });
  it("every role has a guide entry", () => {
    for (const r of ["creator", "expert", "brand_manager"] as const) expect(ROLE_INFO[r].does.length).toBeGreaterThan(0);
  });
});

describe("brand slugs", () => {
  it("makes a safe URL name", () => {
    expect(slugify("Voltaro Energy!")).toBe("voltaro-energy");
    expect(slugify("  Café  Nové ")).toBe("cafe-nove");
    expect(slugify("---")).toMatch(/^[a-z0-9-]*$/);
  });
});
