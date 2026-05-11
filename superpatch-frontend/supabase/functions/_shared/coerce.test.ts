import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { toBool } from "./coerce.ts";

Deno.test("toBool: native booleans pass through", () => {
  assertEquals(toBool(true), true);
  assertEquals(toBool(false), false);
});

Deno.test("toBool: common truthy strings (case + whitespace insensitive)", () => {
  assertEquals(toBool("true"), true);
  assertEquals(toBool("TRUE"), true);
  assertEquals(toBool("  True  "), true);
  assertEquals(toBool("yes"), true);
  assertEquals(toBool("Y"), true);
  assertEquals(toBool("1"), true);
});

Deno.test("toBool: common falsy strings", () => {
  assertEquals(toBool("false"), false);
  assertEquals(toBool("FALSE"), false);
  assertEquals(toBool("no"), false);
  assertEquals(toBool("0"), false);
  assertEquals(toBool(""), false);
  assertEquals(toBool("   "), false);
  assertEquals(toBool("maybe"), false);
});

Deno.test("toBool: numbers (non-zero → true, zero/NaN/Infinity → false)", () => {
  assertEquals(toBool(1), true);
  assertEquals(toBool(-1), true);
  assertEquals(toBool(0.5), true);
  assertEquals(toBool(0), false);
  assertEquals(toBool(NaN), false);
  assertEquals(toBool(Infinity), false);
});

Deno.test("toBool: null/undefined/objects/arrays default to false (no throws)", () => {
  assertEquals(toBool(null), false);
  assertEquals(toBool(undefined), false);
  assertEquals(toBool({}), false);
  assertEquals(toBool([]), false);
  assertEquals(toBool(["true"]), false);
});
