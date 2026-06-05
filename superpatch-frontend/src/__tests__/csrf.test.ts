/**
 * Same-origin / CSRF guard tests.
 *
 * Asserts the pure helper used by /api/auth/signout (and any other
 * cookie-auth state-changing route) correctly distinguishes legitimate
 * first-party browser POSTs from cross-site requests that have ridden
 * along on the user's session cookie.
 */
import { describe, it, expect } from "vitest";
import { isSameOrigin } from "@/lib/csrf";

describe("isSameOrigin", () => {
  it("missing Origin -> rejected (missing_origin)", () => {
    expect(isSameOrigin({ origin: null, siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "missing_origin" });
  });

  it("empty Origin -> rejected", () => {
    expect(isSameOrigin({ origin: "", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "missing_origin" });
  });

  it("malformed Origin -> rejected (mismatched_origin)", () => {
    expect(isSameOrigin({ origin: "not-a-url", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });

  it("matching siteUrl exactly -> accepted", () => {
    expect(isSameOrigin({ origin: "https://app.example.com", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: true });
  });

  it("siteUrl with trailing path is normalized to scheme+host", () => {
    expect(isSameOrigin({ origin: "https://app.example.com", siteUrl: "https://app.example.com/login" }))
      .toEqual({ ok: true });
  });

  it("origin with explicit default port is treated as equivalent (URL parser strips :443 for https)", () => {
    expect(isSameOrigin({ origin: "https://app.example.com:443", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: true });
  });

  it("origin with explicit NON-default port is rejected", () => {
    expect(isSameOrigin({ origin: "https://app.example.com:8443", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });

  it("attacker.com is rejected even when siteUrl is set", () => {
    expect(isSameOrigin({ origin: "https://attacker.com", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });

  it("subdomain of siteUrl is rejected (strict matching)", () => {
    expect(isSameOrigin({ origin: "https://evil.app.example.com", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });

  it("localhost:3000 is accepted even without siteUrl (dev mode)", () => {
    expect(isSameOrigin({ origin: "http://localhost:3000", siteUrl: undefined }))
      .toEqual({ ok: true });
    expect(isSameOrigin({ origin: "http://127.0.0.1:3000", siteUrl: undefined }))
      .toEqual({ ok: true });
  });

  it("localhost on a different port is rejected", () => {
    expect(isSameOrigin({ origin: "http://localhost:4000", siteUrl: undefined }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });

  it("file:// origin (some browser quirks) is rejected", () => {
    expect(isSameOrigin({ origin: "file://", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });

  it("null literal Origin string (some sandboxed iframes send 'null') is rejected", () => {
    // "null" as a string is a real value some browsers send; it must NOT
    // match our localhost/site allowlist.
    expect(isSameOrigin({ origin: "null", siteUrl: "https://app.example.com" }))
      .toEqual({ ok: false, reason: "mismatched_origin" });
  });
});
