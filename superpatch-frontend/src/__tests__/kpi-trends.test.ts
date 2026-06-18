import { describe, it, expect } from "vitest";
import { computeRecentCallCounts } from "@/components/campaign/kpi-utils";

describe("computeRecentCallCounts", () => {
  it("buckets records into the last N local days", () => {
    const now = new Date();
    const recs = [
      { created_at: now.toISOString() },
      { created_at: now.toISOString() },
    ];
    const counts = computeRecentCallCounts(recs as never, 7);
    expect(counts).toHaveLength(7);
    expect(counts[counts.length - 1]).toBe(2);
  });
  it("returns all-zero array of length N when no records", () => {
    expect(computeRecentCallCounts([] as never, 7)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
