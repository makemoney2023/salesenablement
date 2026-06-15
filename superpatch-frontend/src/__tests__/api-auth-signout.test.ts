/**
 * End-to-end test for /api/auth/signout.
 *
 * Asserts:
 *  1. POST without an Origin header -> 403 (CSRF logout blocked)
 *  2. POST with an attacker.com Origin -> 403
 *  3. POST with a same-origin Origin but no session -> 401
 *  4. POST with a same-origin Origin AND a session -> 302 redirect to /login
 *
 * The Supabase client is mocked at the module level. We then inject the
 * route handler's NextRequest via the standard Next.js Request shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase server module. Each test resets the mock so we can
// alternate between "logged in" and "anonymous" callers.
const signOutMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
  })),
}));

import { POST } from "@/app/api/auth/signout/route";

function makeReq(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/auth/signout", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/signout", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    getUserMock.mockReset();
    // Default to logged-in user so the same-origin tests are positive
    // unless overridden.
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    signOutMock.mockResolvedValue({ error: null });
    // Pin the site URL so the test is deterministic regardless of env.
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  it("returns 403 when the Origin header is missing (defends against form-POST CSRF)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeReq({}) as any);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("forbidden_origin");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the Origin is a third-party site", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeReq({ origin: "https://attacker.com" }) as any);
    expect(res.status).toBe(403);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("returns 401 when same-origin but no active session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeReq({ origin: "http://localhost:3000" }) as any);
    expect(res.status).toBe(401);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("returns 302 redirect to /login when same-origin AND authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeReq({ origin: "http://localhost:3000" }) as any);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
