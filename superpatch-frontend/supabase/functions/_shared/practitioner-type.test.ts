import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  canonicalPractitionerType,
  displayName,
  pathwaySummaryFor,
} from "./practitioner-type.ts";

Deno.test("canonicalPractitionerType collapses slugs, casings, aliases, and _v<n> tags", () => {
  assertEquals(canonicalPractitionerType("Chiropractors"), "chiropractor");
  assertEquals(canonicalPractitionerType("CHIROPRACTOR"), "chiropractor");
  assertEquals(canonicalPractitionerType("chiropractor_v2"), "chiropractor");
  assertEquals(canonicalPractitionerType("chiropractor_v17"), "chiropractor");

  assertEquals(canonicalPractitionerType("Massage Therapists"), "massage_therapist");
  assertEquals(canonicalPractitionerType("RMT"), "massage_therapist");
  assertEquals(canonicalPractitionerType("massage"), "massage_therapist");

  assertEquals(canonicalPractitionerType("Naturopaths"), "naturopath");
  assertEquals(canonicalPractitionerType("Naturopathic Doctor"), "naturopath");

  assertEquals(canonicalPractitionerType("Integrative Medicine"), "integrative_medicine");
  assertEquals(canonicalPractitionerType("integrative"), "integrative_medicine");
  assertEquals(canonicalPractitionerType("integrative medicine doctor"), "integrative_medicine");

  assertEquals(canonicalPractitionerType("Functional Medicine"), "functional_medicine");
  assertEquals(canonicalPractitionerType("functional"), "functional_medicine");

  assertEquals(canonicalPractitionerType("Acupuncturists"), "acupuncturist");
});

Deno.test("canonicalPractitionerType falls back to 'unknown' for empty / unmatched input", () => {
  assertEquals(canonicalPractitionerType(undefined), "unknown");
  assertEquals(canonicalPractitionerType(null), "unknown");
  assertEquals(canonicalPractitionerType(""), "unknown");
  assertEquals(canonicalPractitionerType("   "), "unknown");
  assertEquals(canonicalPractitionerType("dentist"), "unknown");
});

Deno.test("displayName returns canonical human label", () => {
  assertEquals(displayName("chiropractor"), "Chiropractors");
  assertEquals(displayName("massage_therapist"), "Massage Therapists");
  assertEquals(displayName("naturopath"), "Naturopaths");
  assertEquals(displayName("acupuncturist"), "Acupuncturists");
  assertEquals(displayName("unknown"), "Unknown");
});

Deno.test("pathwaySummaryFor returns canonical + non-empty summary; unknown gets fallback", () => {
  const chiro = pathwaySummaryFor("chiropractor_v2");
  assertEquals(chiro.canonical, "chiropractor");
  assertEquals(chiro.summary.length > 0, true);

  const acup = pathwaySummaryFor("Acupuncturists");
  assertEquals(acup.canonical, "acupuncturist");
  assertEquals(acup.summary.includes("Acupuncture"), true);

  const fallback = pathwaySummaryFor("nonsense");
  assertEquals(fallback.canonical, "unknown");
  assertEquals(fallback.summary.includes("Unknown"), true);
});
