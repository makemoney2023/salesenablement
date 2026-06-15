/**
 * Tests that the server-side call records DB layer uses the service-role
 * admin client (src/lib/db/call-records.ts).
 *
 * Regression: these functions are called from API routes (server-side) where
 * the anon client carries no user JWT. Under is_active_user() RLS that means
 * auth.uid() IS NULL -> reads return empty and writes fail. They must prefer
 * supabaseAdmin (service role), consistent with every other API route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminClient, anonClient } = vi.hoisted(() => {
  const make = (rows: Record<string, unknown>[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    // Builder is thenable so `await query` (e.g. getAllCallRecords) resolves
    // to the row list, while explicit terminators still work below.
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: rows, error: null });
    builder.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: rows[0] ?? null, error: null })
    );
    builder.single = vi.fn(() =>
      Promise.resolve({ data: rows[0] ?? null, error: null })
    );
    return { from: vi.fn(() => builder) };
  };
  return {
    adminClient: make([
      { practitioner_id: "p1", id: "r1", status: "completed" },
    ]),
    anonClient: make([]),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: anonClient,
  supabaseAdmin: adminClient,
  isSupabaseConfigured: true,
}));

describe("call-records DB layer client selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllCallRecords queries via the admin client, not the anon client", async () => {
    const { getAllCallRecords } = await import("@/lib/db/call-records");
    const records = await getAllCallRecords();

    expect(adminClient.from).toHaveBeenCalledWith("call_records");
    expect(anonClient.from).not.toHaveBeenCalled();
    expect(records.p1).toBeDefined();
  });

  it("getCampaignStats queries via the admin client", async () => {
    const { getCampaignStats } = await import("@/lib/db/call-records");
    await getCampaignStats();

    expect(adminClient.from).toHaveBeenCalledWith("call_records");
    expect(anonClient.from).not.toHaveBeenCalled();
  });

  it("getCallRecord is multi-row safe (orders, limits 1, maybeSingle) and returns the latest", async () => {
    const { getCallRecord } = await import("@/lib/db/call-records");
    const record = await getCallRecord("p1");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = adminClient.from.mock.results[0].value;
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(builder.single).not.toHaveBeenCalled();
    expect(record?.id).toBe("r1");
  });
});
