import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildNotesUpdate } from "./notes.ts";

Deno.test("buildNotesUpdate appends the Cal booking ID instead of overwriting prior notes", () => {
  const result = buildNotesUpdate("Prior notes from agent", "xyz-123");
  assertEquals(result, "Prior notes from agent\nCal.com Booking ID: xyz-123");
});

Deno.test("buildNotesUpdate returns the booking line alone when prior is null / undefined / blank", () => {
  assertEquals(buildNotesUpdate(null, "abc"), "Cal.com Booking ID: abc");
  assertEquals(buildNotesUpdate(undefined, "abc"), "Cal.com Booking ID: abc");
  assertEquals(buildNotesUpdate("", "abc"), "Cal.com Booking ID: abc");
  assertEquals(buildNotesUpdate("   \n  ", "abc"), "Cal.com Booking ID: abc");
});

Deno.test("buildNotesUpdate is idempotent — re-running with the same booking ID does not duplicate", () => {
  const first = buildNotesUpdate("Some prior summary", "uid-1");
  const second = buildNotesUpdate(first, "uid-1");
  assertEquals(second, first);
});

Deno.test("buildNotesUpdate trims only the trailing whitespace of prior notes (keeps interior formatting)", () => {
  const prior = "Line A\n\nLine B   \n";
  const result = buildNotesUpdate(prior, "uid-2");
  assertEquals(result, "Line A\n\nLine B\nCal.com Booking ID: uid-2");
});
