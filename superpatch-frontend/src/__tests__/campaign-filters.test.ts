/**
 * Tests for campaign list filter helpers (src/lib/campaign-filters.ts).
 *
 * Regression: the campaign page exposed a "has website" toggle and a call
 * status multi-select, but neither was applied to the practitioner list. These
 * pure helpers back those filters so they can be unit-tested.
 */
import { describe, it, expect } from "vitest";
import { applyListFilters, matchesCallStatus } from "@/lib/campaign-filters";
import type { CallStatus } from "@/lib/db/types";

const practitioners = [
  { id: "a", website: "https://a.com" },
  { id: "b", website: null },
  { id: "c", website: "https://c.com" },
];

const callRecords: Record<string, { status?: CallStatus } | undefined> = {
  a: { status: "completed" },
  b: { status: "queued" },
  // c has no record -> treated as not_called
};

describe("matchesCallStatus", () => {
  it("matches everything when filter is empty", () => {
    expect(matchesCallStatus("completed", [])).toBe(true);
    expect(matchesCallStatus(undefined, [])).toBe(true);
  });

  it("treats missing status as not_called", () => {
    expect(matchesCallStatus(undefined, ["not_called"])).toBe(true);
    expect(matchesCallStatus(undefined, ["completed"])).toBe(false);
  });

  it("matches when status is in the filter", () => {
    expect(matchesCallStatus("queued", ["queued", "completed"])).toBe(true);
    expect(matchesCallStatus("failed", ["queued", "completed"])).toBe(false);
  });
});

describe("applyListFilters", () => {
  it("returns all when no filters active", () => {
    const result = applyListFilters(practitioners, {
      hasWebsiteOnly: false,
      callStatusFilter: [],
      callRecords,
    });
    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("filters to only practitioners with a website", () => {
    const result = applyListFilters(practitioners, {
      hasWebsiteOnly: true,
      callStatusFilter: [],
      callRecords,
    });
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filters by call status (including not_called for missing records)", () => {
    const result = applyListFilters(practitioners, {
      hasWebsiteOnly: false,
      callStatusFilter: ["not_called"],
      callRecords,
    });
    expect(result.map((p) => p.id)).toEqual(["c"]);
  });

  it("combines website and status filters", () => {
    const result = applyListFilters(practitioners, {
      hasWebsiteOnly: true,
      callStatusFilter: ["completed"],
      callRecords,
    });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
});
