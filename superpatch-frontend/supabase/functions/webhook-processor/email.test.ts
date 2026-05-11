import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { pickSampleEmail } from "./email.ts";

Deno.test("pickSampleEmail prefers the form email when present and valid", () => {
  assertEquals(
    pickSampleEmail({
      aiEmail: "ai@weird.xyz",
      formEmail: "real@clinic.ca",
      dbEmail: "stale@old.com",
    }),
    "real@clinic.ca",
  );
});

Deno.test("pickSampleEmail falls back to the DB email when form is null/invalid", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: null, formEmail: null, dbEmail: "known@clinic.ca" }),
    "known@clinic.ca",
  );
  assertEquals(
    pickSampleEmail({ aiEmail: null, formEmail: "not-an-email", dbEmail: "known@clinic.ca" }),
    "known@clinic.ca",
  );
});

Deno.test("pickSampleEmail uses the AI email only when form and DB are absent", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: "ai@clinic.ca", formEmail: null, dbEmail: null }),
    "ai@clinic.ca",
  );
});

Deno.test("pickSampleEmail returns null when no source produces a valid email", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: "not an email", formEmail: "", dbEmail: null }),
    null,
  );
  assertEquals(
    pickSampleEmail({ aiEmail: null, formEmail: null, dbEmail: null }),
    null,
  );
});

Deno.test("pickSampleEmail lowercases and trims the chosen value", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: null, formEmail: "  Real@Clinic.CA  ", dbEmail: null }),
    "real@clinic.ca",
  );
});

Deno.test("pickSampleEmail rejects values with whitespace inside the local-part", () => {
  // sanitizeTranscribedEmail upstream catches "Chris B at superpatch.com",
  // but a doubly-mangled "chris b@superpatch.com" should still fail here.
  assertEquals(
    pickSampleEmail({ aiEmail: "chris b@superpatch.com", formEmail: null, dbEmail: null }),
    null,
  );
});
