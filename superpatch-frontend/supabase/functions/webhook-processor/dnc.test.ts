import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { DNC_PHRASES, detectDNCRequest } from "./dnc.ts";

Deno.test("detectDNCRequest flags explicit do-not-call requests", () => {
  for (const phrase of [
    "please do not call me again",
    "stop calling this number",
    "take me off your list",
    "remove my number from your records",
  ]) {
    assertEquals(detectDNCRequest(phrase).detected, true, phrase);
  }
});

Deno.test("detectDNCRequest does NOT flag a plain 'not interested' objection", () => {
  const result = detectDNCRequest(
    "Thanks but I'm not interested in samples right now.",
  );
  assertEquals(result.detected, false);
  assertEquals(result.matchedPhrase, null);
});

Deno.test("DNC_PHRASES no longer contains 'not interested'", () => {
  assertEquals(DNC_PHRASES.includes("not interested"), false);
});

Deno.test("detectDNCRequest returns false for empty transcript", () => {
  assertEquals(detectDNCRequest("").detected, false);
});
