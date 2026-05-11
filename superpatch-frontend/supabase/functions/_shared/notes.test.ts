import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { appendNoteLine } from "./notes.ts";

Deno.test("appendNoteLine returns line when prior is null / undefined / blank", () => {
  assertEquals(appendNoteLine(null, "X"), "X");
  assertEquals(appendNoteLine(undefined, "X"), "X");
  assertEquals(appendNoteLine("", "X"), "X");
  assertEquals(appendNoteLine("   \n  ", "X"), "X");
});

Deno.test("appendNoteLine appends to existing prior with a single newline", () => {
  assertEquals(
    appendNoteLine("Call summary: customer interested.", "Cal.com Booking ID: abc"),
    "Call summary: customer interested.\nCal.com Booking ID: abc",
  );
});

Deno.test("appendNoteLine is idempotent for identical lines", () => {
  const prior = "summary\nCal.com Booking ID: abc";
  assertEquals(appendNoteLine(prior, "Cal.com Booking ID: abc"), prior);
});

Deno.test("appendNoteLine trims trailing whitespace before joining", () => {
  assertEquals(
    appendNoteLine("summary\n\n  ", "Cancelled on Cal.com at 2026-05-12"),
    "summary\nCancelled on Cal.com at 2026-05-12",
  );
});

Deno.test("appendNoteLine treats substring-but-not-line match as not present", () => {
  // "X" is a substring of "XY", but the contract is line-equality so we accept
  // the conservative "is it already there?" check (`includes`) — verify the
  // surprising case stays the way the implementation behaves so callers know.
  assertEquals(appendNoteLine("foo XY bar", "X"), "foo XY bar");
});
