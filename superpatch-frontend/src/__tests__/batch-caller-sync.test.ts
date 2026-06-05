/**
 * Tests that BatchCaller propagates status transitions to Supabase
 * (src/lib/batch-caller.ts).
 *
 * Regression: status changes (queued / in_progress / failed / completed)
 * were written to localStorage only, while the campaign UI reads from
 * Supabase via useSupabaseCallRecords. During an active campaign the queue,
 * KPIs and badges went stale. BatchCaller must PATCH /api/campaign/calls on
 * each status change so the row createCallRecord already synced is updated.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const updatedRecord = {
  practitioner_id: "test-id",
  practitioner_name: "Dr. Test",
  practitioner_type: "chiropractor",
  phone: "4165551234",
  address: "123 Main St",
  city: "Toronto",
  province: "ON",
  status: "in_progress",
  call_id: "call-123",
  call_started_at: "2026-06-05T00:00:00.000Z",
  appointment_booked: false,
  calendar_invite_sent: false,
  created_at: "2026-06-05T00:00:00.000Z",
  updated_at: "2026-06-05T00:00:00.000Z",
};

vi.mock("@/lib/campaign-storage", () => ({
  createCallRecord: vi.fn(() => ({ ...updatedRecord, status: "not_called" })),
  getCallRecord: vi.fn(() => ({ ...updatedRecord, status: "queued" })),
  updateCallStatus: vi.fn(() => ({ ...updatedRecord })),
  syncCallRecordToSupabase: vi.fn(() => Promise.resolve(true)),
  getCampaignQueueState: vi.fn(() => ({
    is_running: false,
    delay_between_calls_ms: 60000,
    current_call_id: null,
    current_practitioner_id: null,
  })),
  saveCampaignQueueState: vi.fn(),
  removeFromQueue: vi.fn(),
}));

vi.mock("@/lib/config/pathways", () => ({
  KB_ID: "test-kb-id",
  VOICE_ID: "test-voice-id",
  WEBHOOK_URL: "https://test.supabase.co/functions/v1/webhook-processor",
  getPathwayId: vi.fn((type: string) => `pathway-for-${type.toLowerCase()}`),
}));

function patchCallsTo(url: string) {
  return (call: unknown[]) =>
    call[0] === url && (call[1] as RequestInit | undefined)?.method === "PATCH";
}

describe("BatchCaller Supabase status sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCHes /api/campaign/calls after a successful call (in_progress)", async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url === "/api/bland/calls") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ status: "success", call_id: "call-123" }),
        });
      }
      // /api/campaign/calls PATCH
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { getBatchCaller } = await import("@/lib/batch-caller");
    const caller = getBatchCaller();

    const result = await caller.makeCall({
      id: "test-id",
      name: "Dr. Test",
      practitioner_type: "chiropractor",
      address: "123 Main St",
      city: "Toronto",
      province: "ON",
      phone: "4165551234",
    });

    expect(result.success).toBe(true);

    // Allow the fire-and-forget sync microtask to run.
    await Promise.resolve();
    await Promise.resolve();

    const calls = mockFetch.mock.calls as unknown[][];
    const patchCall = calls.find(patchCallsTo("/api/campaign/calls"));
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.practitioner_id).toBe("test-id");
    expect(body.status).toBe("in_progress");
    expect(body.call_id).toBe("call-123");
  });
});
