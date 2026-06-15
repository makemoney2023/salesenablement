/**
 * Tests that post-import auto-enrichment invokes the enrich-practitioners-v2
 * Edge Function with a service-role bearer
 * (src/app/api/search/import/route.ts).
 *
 * Regression: the route did a server-side fetch to the cookie-protected
 * /api/search/enrich route, which had no session and returned 401, so
 * enrichment silently never ran. It must instead call the Supabase Edge
 * Function directly with the service-role key.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAuth: vi.fn(async () => ({ authorized: true, response: null })),
}));

vi.mock("@/lib/supabase", () => {
  const makeBuilder = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = { _insert: false, _id: undefined };
    b.select = () => b;
    b.eq = () => b;
    b.like = () => b;
    b.in = () => b;
    b.not = () => b;
    b.limit = () => b;
    b.insert = (rec: { id: string }) => {
      b._insert = true;
      b._id = rec.id;
      return b;
    };
    b.single = () =>
      Promise.resolve(
        b._insert ? { data: { id: b._id }, error: null } : { data: null, error: null }
      );
    // Awaitable for chains that don't end in .single() (phone dup check).
    b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    return b;
  };
  return {
    isSupabaseConfigured: true,
    supabaseAdmin: { from: () => makeBuilder() },
    supabase: { from: () => makeBuilder() },
  };
});

describe("POST /api/search/import auto-enrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("calls the enrich-practitioners-v2 Edge Function with a service-role bearer", async () => {
    const { POST } = await import("@/app/api/search/import/route");
    const req = new NextRequest("http://localhost/api/search/import", {
      method: "POST",
      body: JSON.stringify({
        places: [
          {
            id: "place-1",
            name: "Test Clinic",
            website: "https://testclinic.com",
            country: "CA",
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Fire-and-forget enrichment kicks off synchronously; allow its microtask.
    await Promise.resolve();

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const enrichCall = (fetchMock.mock.calls as unknown[][]).find((c) =>
      String(c[0]).includes("/functions/v1/enrich-practitioners-v2")
    );
    expect(enrichCall).toBeDefined();

    const init = enrichCall![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service-role-key");

    const body = JSON.parse(init.body as string);
    expect(body.practitionerIds).toContain("place-1");
  });
});
