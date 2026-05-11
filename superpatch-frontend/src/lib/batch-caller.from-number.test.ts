import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("resolveFromNumber", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads NEXT_PUBLIC_BLAND_FROM_NUMBER", async () => {
    vi.stubEnv("NEXT_PUBLIC_BLAND_FROM_NUMBER", "+15555550123");
    const { resolveFromNumber } = await import("./batch-caller");
    expect(resolveFromNumber()).toBe("+15555550123");
  });

  it("returns undefined when NEXT_PUBLIC_BLAND_FROM_NUMBER is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BLAND_FROM_NUMBER", "");
    const { resolveFromNumber } = await import("./batch-caller");
    expect(resolveFromNumber()).toBeUndefined();
  });

  it("trims surrounding whitespace and treats whitespace-only as unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BLAND_FROM_NUMBER", "  +15555550123  ");
    const { resolveFromNumber: resolveTrim } = await import("./batch-caller");
    expect(resolveTrim()).toBe("+15555550123");

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_BLAND_FROM_NUMBER", "   ");
    const { resolveFromNumber: resolveBlank } = await import("./batch-caller");
    expect(resolveBlank()).toBeUndefined();
  });

  it("does not fall back to the server-only BLAND_FROM_NUMBER var", async () => {
    vi.stubEnv("NEXT_PUBLIC_BLAND_FROM_NUMBER", "");
    vi.stubEnv("BLAND_FROM_NUMBER", "+19999999999");
    const { resolveFromNumber } = await import("./batch-caller");
    expect(resolveFromNumber()).toBeUndefined();
  });
});
