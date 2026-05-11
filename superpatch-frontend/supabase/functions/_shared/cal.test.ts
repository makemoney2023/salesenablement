import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createCalBooking, CalError } from "./cal.ts";

Deno.test("createCalBooking posts to v2 with required headers and body", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({ status: "success", data: { id: 999, uid: "abc", status: "accepted" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createCalBooking(
    {
      eventTypeId: 4004901,
      start: "2026-05-01T14:00:00.000Z",
      attendee: { name: "Dr Alice", email: "alice@example.com", timeZone: "America/Toronto" },
      metadata: { practitioner_id: "p-1", call_record_id: "c-1" },
    },
    { apiKey: "cal_live_test", apiVersion: "2024-08-13", fetchImpl: fakeFetch },
  );

  assertEquals(result.uid, "abc");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://api.cal.com/v2/bookings");
  const headers = new Headers(calls[0].init.headers);
  assertEquals(headers.get("authorization"), "Bearer cal_live_test");
  assertEquals(headers.get("cf-api-version"), "2024-08-13");
  const body = JSON.parse(String(calls[0].init.body));
  assertEquals(body.attendee.timeZone, "America/Toronto");
  assertEquals(body.eventTypeId, 4004901);
});

Deno.test("createCalBooking throws CalError on non-2xx", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: "slot taken" } }), { status: 409 });

  await assertRejects(
    () =>
      createCalBooking(
        {
          eventTypeId: 1,
          start: "2026-05-01T14:00:00.000Z",
          attendee: { name: "x", email: "x@y.z", timeZone: "UTC" },
        },
        { apiKey: "k", apiVersion: "2024-08-13", fetchImpl: fakeFetch },
      ),
    CalError,
    "slot taken",
  );
});
