import { describe, it, expect } from "vitest";
import { SAMPLES_CSV_MAX_ROWS } from "./constants";

describe("samples csv cap", () => {
  it("is 10000", () => {
    expect(SAMPLES_CSV_MAX_ROWS).toBe(10_000);
  });
});
