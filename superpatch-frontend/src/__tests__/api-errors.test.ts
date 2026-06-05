/**
 * Sanitization contract for 5xx response bodies returned by Next.js API
 * routes. Asserts that the helper never leaks the raw error message
 * (which could include Postgres detail, stack info, internal hostnames,
 * etc.) into the response body.
 */
import { describe, it, expect } from "vitest";
import { sanitizeApiError } from "@/lib/api-errors";

describe("sanitizeApiError", () => {
  it("returns the {status, code, message} shape with default code", () => {
    const out = sanitizeApiError(new Error("something exploded"));
    expect(out.status).toBe("error");
    expect(out.code).toBe("internal_error");
    expect(out.message).toBe("An internal error occurred. Please contact support.");
  });

  it("accepts an enum-like code", () => {
    const out = sanitizeApiError(new Error("anything"), { code: "campaign_get_failed" });
    expect(out.code).toBe("campaign_get_failed");
  });

  it("never includes the raw error message in the body", () => {
    const err = new Error("PGRST116: row not found at db.example.com");
    const out = sanitizeApiError(err, { code: "db_error" });
    expect(JSON.stringify(out)).not.toContain("PGRST116");
    expect(JSON.stringify(out)).not.toContain("db.example.com");
  });

  it("never includes a stack trace", () => {
    const err = new Error("boom");
    const out = sanitizeApiError(err, { code: "test" });
    expect(JSON.stringify(out)).not.toContain("at Object.");
    expect(JSON.stringify(out)).not.toContain(".test.ts");
  });

  it("custom clientMessage overrides the default", () => {
    const out = sanitizeApiError(new Error("boom"), {
      code: "invalid_request",
      clientMessage: "Practitioner id is required.",
    });
    expect(out.message).toBe("Practitioner id is required.");
  });

  it("handles non-Error inputs without throwing", () => {
    expect(() => sanitizeApiError("string error", { code: "x" })).not.toThrow();
    expect(() => sanitizeApiError(null, { code: "x" })).not.toThrow();
    expect(() => sanitizeApiError(undefined, { code: "x" })).not.toThrow();
    expect(() => sanitizeApiError({ wat: "yes" }, { code: "x" })).not.toThrow();
  });

  it("output shape is exactly {status, code, message} — no other keys", () => {
    const out = sanitizeApiError(new Error("boom"));
    expect(Object.keys(out).sort()).toEqual(["code", "message", "status"]);
  });
});
