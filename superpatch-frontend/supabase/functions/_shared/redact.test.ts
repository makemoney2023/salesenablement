import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  redactEmail,
  redactName,
  redactPhone,
  redactPii,
  redactTranscript,
} from "./redact.ts";

// ============================================
// redactPhone
// ============================================

Deno.test("redactPhone - E.164 number keeps country code + last 2", () => {
  // +15192427550 has 11 digits: 1 (cc) + 5192427550 (10-digit national).
  // We keep cc + last 2; the middle 8 become asterisks.
  assertEquals(redactPhone("+15192427550"), "+1********50");
});

Deno.test("redactPhone - 10-digit US number keeps last 2", () => {
  assertEquals(redactPhone("5192427550"), "********50");
});

Deno.test("redactPhone - formatted number is stripped then masked", () => {
  assertEquals(redactPhone("(519) 242-7550"), "********50");
});

Deno.test("redactPhone - null returns null marker", () => {
  assertEquals(redactPhone(null), "<null>");
});

Deno.test("redactPhone - undefined returns null marker", () => {
  assertEquals(redactPhone(undefined), "<null>");
});

Deno.test("redactPhone - empty string returns empty marker", () => {
  assertEquals(redactPhone(""), "<empty>");
});

Deno.test("redactPhone - too short to safely redact returns <short>", () => {
  // A 1- or 2-digit string is not a real phone; don't emit it raw.
  assertEquals(redactPhone("12"), "<short>");
});

// ============================================
// redactEmail
// ============================================

Deno.test("redactEmail - keeps domain, first char of local", () => {
  assertEquals(redactEmail("alice@example.com"), "a****@example.com");
});

Deno.test("redactEmail - short local part still masks", () => {
  assertEquals(redactEmail("a@example.com"), "a****@example.com");
});

Deno.test("redactEmail - case is preserved on domain, lowercased local first char", () => {
  assertEquals(redactEmail("Alice@Example.com"), "a****@Example.com");
});

Deno.test("redactEmail - missing @ returns invalid marker", () => {
  assertEquals(redactEmail("not-an-email"), "<invalid-email>");
});

Deno.test("redactEmail - null returns null marker", () => {
  assertEquals(redactEmail(null), "<null>");
});

Deno.test("redactEmail - empty string returns empty marker", () => {
  assertEquals(redactEmail(""), "<empty>");
});

// ============================================
// redactName
// ============================================

Deno.test("redactName - keeps first letter of each whitespace-separated word", () => {
  assertEquals(redactName("Alice Bob Carter"), "A. B. C.");
});

Deno.test("redactName - single word", () => {
  assertEquals(redactName("Alice"), "A.");
});

Deno.test("redactName - trims and collapses whitespace", () => {
  assertEquals(redactName("  Alice   Carter  "), "A. C.");
});

Deno.test("redactName - null returns null marker", () => {
  assertEquals(redactName(null), "<null>");
});

Deno.test("redactName - empty string returns empty marker", () => {
  assertEquals(redactName(""), "<empty>");
});

// ============================================
// redactTranscript
// ============================================

Deno.test("redactTranscript - returns length + first 40 char snippet hint, never raw text", () => {
  const transcript = "Hello, this is Dr Alice from the Wellness Clinic. Can you hear me?";
  const out = redactTranscript(transcript);
  // Must NOT include the practitioner name.
  assertEquals(out.includes("Alice"), false);
  // Must NOT include the clinic name.
  assertEquals(out.includes("Wellness"), false);
  // Should give us a length and a generic shape so we can grep.
  assertEquals(out.includes("len="), true);
});

Deno.test("redactTranscript - null returns null marker", () => {
  assertEquals(redactTranscript(null), "<null>");
});

Deno.test("redactTranscript - empty returns empty marker", () => {
  assertEquals(redactTranscript(""), "<empty>");
});

// ============================================
// redactPii - object scrubber
// ============================================

Deno.test("redactPii - scrubs common PII keys recursively", () => {
  const input = {
    practitioner_name: "Dr Alice Carter",
    phone: "+15192427550",
    email: "alice@example.com",
    address: "123 Main St",
    nested: {
      contact_email: "bob@example.com",
      first_name: "Bob",
    },
    safe_id: "rec_abc",
  };
  const out = redactPii(input);
  // Names + emails + phones are redacted. "Dr Alice Carter" -> "D. A. C."
  // (every space-separated token gets an initial). That's fine: the goal
  // is to defeat re-identification, not look pretty.
  assertEquals(out.practitioner_name, "D. A. C.");
  assertEquals(out.phone, "+1********50");
  assertEquals(out.email, "a****@example.com");
  assertEquals(out.address, "<redacted>");
  // Nested objects are walked.
  assertEquals(out.nested.contact_email, "b****@example.com");
  assertEquals(out.nested.first_name, "B.");
  // Non-PII keys are left alone.
  assertEquals(out.safe_id, "rec_abc");
});

Deno.test("redactPii - handles array input", () => {
  const input = [
    { phone: "5192427550" },
    { phone: "4165550100" },
  ];
  const out = redactPii(input) as { phone: string }[];
  assertEquals(out[0].phone, "********50");
  assertEquals(out[1].phone, "********00");
});

Deno.test("redactPii - null input returns null", () => {
  assertEquals(redactPii(null), null);
});

Deno.test("redactPii - primitives passed through", () => {
  assertEquals(redactPii(42), 42);
  assertEquals(redactPii("hello"), "hello");
  assertEquals(redactPii(true), true);
});

Deno.test("redactPii - matches case-insensitively on field names", () => {
  const input = { Phone: "5192427550", FULLNAME: "Alice Carter" };
  const out = redactPii(input) as { Phone: string; FULLNAME: string };
  assertEquals(out.Phone, "********50");
  assertEquals(out.FULLNAME, "A. C.");
});
