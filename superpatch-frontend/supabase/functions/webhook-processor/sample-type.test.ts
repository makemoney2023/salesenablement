import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildProductsRequested, classifySampleType } from "./sample-type.ts";

Deno.test("classifySampleType: empty / all / standard_kit → standard_kit", () => {
  assertEquals(classifySampleType(""), "standard_kit");
  assertEquals(classifySampleType(null), "standard_kit");
  assertEquals(classifySampleType(undefined), "standard_kit");
  assertEquals(classifySampleType("all"), "standard_kit");
  assertEquals(classifySampleType("ALL"), "standard_kit");
  assertEquals(classifySampleType("standard_kit"), "standard_kit");
  assertEquals(classifySampleType("Standard_Kit"), "standard_kit");
  assertEquals(classifySampleType("standard kit"), "standard_kit");
  assertEquals(classifySampleType("  standard_kit  "), "standard_kit");
});

Deno.test("classifySampleType: anything else → custom", () => {
  assertEquals(classifySampleType("freedom"), "custom");
  assertEquals(classifySampleType("freedom,boost"), "custom");
  assertEquals(classifySampleType("rem"), "custom");
});

Deno.test("buildProductsRequested: standard_kit → null (don't persist the marker)", () => {
  assertEquals(buildProductsRequested("all", "standard_kit"), null);
  assertEquals(buildProductsRequested("standard_kit", "standard_kit"), null);
  assertEquals(buildProductsRequested("", "standard_kit"), null);
});

Deno.test("buildProductsRequested: custom → trimmed, lowercased, comma-split, empties dropped", () => {
  assertEquals(
    buildProductsRequested(" Freedom, Boost ,  REM ", "custom"),
    ["freedom", "boost", "rem"],
  );
});

Deno.test("buildProductsRequested: custom but empty / null raw → null", () => {
  assertEquals(buildProductsRequested("", "custom"), null);
  assertEquals(buildProductsRequested(null, "custom"), null);
  assertEquals(buildProductsRequested(",,,", "custom"), null);
});
