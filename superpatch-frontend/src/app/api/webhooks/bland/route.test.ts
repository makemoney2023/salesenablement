import { describe, it, expect } from "vitest";
import { POST, GET } from "./route";

describe("deprecated /api/webhooks/bland route", () => {
  it("POST returns 410 Gone with a deprecation payload", async () => {
    const req = new Request("http://localhost/api/webhooks/bland", {
      method: "POST",
      body: JSON.stringify({ call_id: "test" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.deprecated).toBe(true);
    expect(typeof body.message).toBe("string");
  });

  it("GET returns 410 Gone", async () => {
    const res = await GET();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.deprecated).toBe(true);
  });
});
