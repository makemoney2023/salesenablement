import { describe, it, expect } from "vitest";
import { sanitizeSearchInput } from "@/lib/security";

/**
 * Regression tests for the /api/samples search clause assembly. The
 * route uses sanitizeSearchInput to scrub PostgREST control characters
 * before interpolating into a `.or()` clause; these tests guard against
 * regressions in either direction (the route's expectations of the
 * sanitizer, and the sanitizer accidentally relaxing its scrub list).
 */
describe("samples search sanitization", () => {
  it("strips PostgREST filter-syntax characters", () => {
    const injected = "foo),shipping_address.is.not.null,(";
    const sanitized = sanitizeSearchInput(injected, 120);
    expect(sanitized).not.toContain("(");
    expect(sanitized).not.toContain(")");
    expect(sanitized).not.toContain(",");
    // Underscores survive but are escaped (preserves the literal value
    // for an ilike match instead of letting it act as a single-char
    // wildcard). Commas and parens are dropped entirely.
    expect(sanitized).toBe("fooshipping\\_address.is.not.null");
  });

  it("escapes ilike wildcards (% and _) so user input cannot match more than it should", () => {
    expect(sanitizeSearchInput("100%", 120)).toBe("100\\%");
    expect(sanitizeSearchInput("test_value", 120)).toBe("test\\_value");
  });

  it("returns empty string for blank input so the .or() clause is skipped", () => {
    expect(sanitizeSearchInput("", 120)).toBe("");
    expect(sanitizeSearchInput("()", 120)).toBe("");
  });

  it("caps length at the route's configured maximum (120)", () => {
    const long = "a".repeat(500);
    expect(sanitizeSearchInput(long, 120).length).toBe(120);
  });
});
