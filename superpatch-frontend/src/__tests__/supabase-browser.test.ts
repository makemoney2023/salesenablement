import { describe, it, expect, vi, beforeEach } from "vitest";

const createClientMock = vi.fn(() => ({ from: vi.fn(), channel: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: createClientMock }));

describe("getBrowserSupabase", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("returns a client and memoizes it", async () => {
    const { getBrowserSupabase } = await import("@/lib/supabase/browser");
    const a = getBrowserSupabase();
    const b = getBrowserSupabase();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when env is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { getBrowserSupabase } = await import("@/lib/supabase/browser");
    expect(getBrowserSupabase()).toBeNull();
  });
});
