/**
 * Tests for PATCH/DELETE /api/practitioners/[id]
 * (src/app/api/practitioners/[id]/route.ts)
 *
 * - PATCH updates only whitelisted fields via the service-role admin client.
 * - DELETE removes the practitioner by id.
 * - Both require auth (401 when unauthorized).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn(
  async (): Promise<{ authorized: boolean; response: Response | null }> => ({
    authorized: true,
    response: null,
  })
);
vi.mock("@/lib/auth", () => ({
  requireApiAuth: () => authMock(),
}));

const updateMock = vi.fn();
const deleteMock = vi.fn();
const selectSingleMock = vi.fn();

vi.mock("@/lib/supabase", () => {
  // Builder supports both:
  //   .from(t).update(u).eq(c,v).select().single()
  //   .from(t).delete().eq(c,v)
  //   .from(t).select(c).eq(c,v).single()
  const makeBuilder = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    b.update = vi.fn((payload: unknown) => {
      updateMock(payload);
      return b;
    });
    b.delete = vi.fn(() => {
      deleteMock();
      return b;
    });
    b.select = vi.fn(() => b);
    b.eq = vi.fn(() => b);
    b.single = vi.fn(() => selectSingleMock());
    return b;
  };
  return {
    isSupabaseConfigured: true,
    supabaseAdmin: { from: vi.fn(() => makeBuilder()) },
    supabase: { from: vi.fn(() => makeBuilder()) },
  };
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ authorized: true, response: null });
});

describe("PATCH /api/practitioners/[id]", () => {
  it("updates only whitelisted fields and returns 200 with success", async () => {
    // First .single() = existence lookup; second .single() = update returning row.
    selectSingleMock
      .mockResolvedValueOnce({ data: { id: "p1", name: "Old" }, error: null })
      .mockResolvedValueOnce({
        data: { id: "p1", name: "New", phone: "416" },
        error: null,
      });

    const { PATCH } = await import("@/app/api/practitioners/[id]/route");
    const req = new NextRequest("http://localhost/api/practitioners/p1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "New",
        phone: "416",
        // Non-whitelisted fields must be dropped, not written.
        do_not_call: true,
        id: "hacked",
      }),
    });
    const res = await PATCH(req, makeParams("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");

    const written = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(written.name).toBe("New");
    expect(written.phone).toBe("416");
    expect(written.do_not_call).toBeUndefined();
    expect(written.id).toBeUndefined();
  });

  it("returns 401 when unauthorized", async () => {
    authMock.mockResolvedValueOnce({
      authorized: false,
      response: new Response("no", { status: 401 }),
    });
    const { PATCH } = await import("@/app/api/practitioners/[id]/route");
    const req = new NextRequest("http://localhost/api/practitioners/p1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
    });
    const res = await PATCH(req, makeParams("p1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no editable fields are provided", async () => {
    const { PATCH } = await import("@/app/api/practitioners/[id]/route");
    const req = new NextRequest("http://localhost/api/practitioners/p1", {
      method: "PATCH",
      body: JSON.stringify({ unknown: "x" }),
    });
    const res = await PATCH(req, makeParams("p1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/practitioners/[id]", () => {
  it("deletes by id and returns 200", async () => {
    selectSingleMock.mockResolvedValueOnce({
      data: { id: "p1", name: "Old" },
      error: null,
    });
    deleteMock.mockReturnValue(undefined);

    const { DELETE } = await import("@/app/api/practitioners/[id]/route");
    const req = new NextRequest("http://localhost/api/practitioners/p1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(deleteMock).toHaveBeenCalled();
  });

  it("returns 401 when unauthorized", async () => {
    authMock.mockResolvedValueOnce({
      authorized: false,
      response: new Response("no", { status: 401 }),
    });
    const { DELETE } = await import("@/app/api/practitioners/[id]/route");
    const req = new NextRequest("http://localhost/api/practitioners/p1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("p1"));
    expect(res.status).toBe(401);
  });
});
