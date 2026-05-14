import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isWithinBusinessHours } from "./business-hours.ts";

// isWithinBusinessHours MUST fail closed: any timezone / formatter / parsing
// error must return false (don't dial) rather than the previous true (do dial).
// The retry queue is allowed to skip a window; it is NOT allowed to call
// people at 3 AM because of a DST edge case.

Deno.test("isWithinBusinessHours returns true at 10 AM Toronto on a weekday", () => {
  // 2026-06-15 is a Monday. 14:00 UTC = 10:00 America/Toronto (EDT, UTC-4).
  const now = new Date("2026-06-15T14:00:00Z");
  assertEquals(isWithinBusinessHours("America/Toronto", now), true);
});

Deno.test("isWithinBusinessHours returns false at 3 AM Toronto on a weekday", () => {
  // 2026-06-15 07:00 UTC = 03:00 America/Toronto.
  const now = new Date("2026-06-15T07:00:00Z");
  assertEquals(isWithinBusinessHours("America/Toronto", now), false);
});

Deno.test("isWithinBusinessHours returns false on Saturday", () => {
  const sat = new Date("2026-06-20T16:00:00Z"); // noon Toronto
  assertEquals(isWithinBusinessHours("America/Toronto", sat), false);
});

Deno.test("isWithinBusinessHours returns false on Sunday", () => {
  const sun = new Date("2026-06-21T16:00:00Z");
  assertEquals(isWithinBusinessHours("America/Toronto", sun), false);
});

Deno.test("isWithinBusinessHours fails closed when timezone is invalid", () => {
  const now = new Date("2026-06-15T14:00:00Z");
  // Intl.DateTimeFormat throws on a bogus timezone -> we must return false,
  // NOT default-allow.
  assertEquals(isWithinBusinessHours("Not/A_Real_Zone", now), false);
});

Deno.test("isWithinBusinessHours fails closed on 5pm boundary (exclusive)", () => {
  // 2026-06-15 21:00 UTC = 17:00 (5pm) Toronto. Should be FALSE.
  const now = new Date("2026-06-15T21:00:00Z");
  assertEquals(isWithinBusinessHours("America/Toronto", now), false);
});

Deno.test("isWithinBusinessHours opens at 9 AM exactly (inclusive)", () => {
  // 2026-06-15 13:00 UTC = 09:00 Toronto. Should be TRUE.
  const now = new Date("2026-06-15T13:00:00Z");
  assertEquals(isWithinBusinessHours("America/Toronto", now), true);
});

Deno.test("isWithinBusinessHours fails closed at 8:59 AM (just before 9)", () => {
  // 2026-06-15 12:59 UTC = 08:59 Toronto.
  const now = new Date("2026-06-15T12:59:00Z");
  assertEquals(isWithinBusinessHours("America/Toronto", now), false);
});
