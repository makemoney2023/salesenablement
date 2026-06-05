/**
 * Tests for useSampleRequests PATCH request shape (src/hooks/useSampleRequests.ts)
 *
 * Regression: the hook previously sent `{ id, updates }` but the /api/samples
 * route (UpdateSampleSchema) expects flat fields. Zod stripped the nested
 * `updates` object, so status changes silently no-op'd. These tests assert the
 * PATCH body carries the update fields at the top level.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Supabase not configured -> no realtime channel, simpler hook lifecycle.
vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

import { useSampleRequests } from "@/hooks/useSampleRequests";

function findPatchCall(mock: ReturnType<typeof vi.fn>) {
  return (mock.mock.calls as unknown[][]).find(
    (call) =>
      call[0] === "/api/samples" &&
      (call[1] as RequestInit | undefined)?.method === "PATCH"
  );
}

describe("useSampleRequests PATCH body shape", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, samples: [], updated: 0 }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends update fields flat (not nested under `updates`) for a single update", async () => {
    const { result } = renderHook(() => useSampleRequests());

    await act(async () => {
      await result.current.updateSample("sample-1", {
        status: "shipped",
        tracking_number: "TRK123",
      });
    });

    const patchCall = findPatchCall(global.fetch as ReturnType<typeof vi.fn>);
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.id).toBe("sample-1");
    expect(body.status).toBe("shipped");
    expect(body.tracking_number).toBe("TRK123");
    expect(body.updates).toBeUndefined();
  });

  it("sends update fields flat for a bulk update", async () => {
    const { result } = renderHook(() => useSampleRequests());

    await act(async () => {
      await result.current.updateMultiple(["a", "b"], { status: "approved" });
    });

    const patchCall = findPatchCall(global.fetch as ReturnType<typeof vi.fn>);
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.ids).toEqual(["a", "b"]);
    expect(body.status).toBe("approved");
    expect(body.updates).toBeUndefined();
  });
});
