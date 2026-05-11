import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createCalBooking, listCalBookings, CalError } from "./cal.ts";
import { normalizeCalStatus } from "../sync-cal-bookings/status.ts";

Deno.test("createCalBooking posts to v2 with required headers and body", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({ status: "success", data: { id: 999, uid: "abc", status: "accepted" } }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createCalBooking(
    {
      eventTypeId: 4004901,
      start: "2026-05-01T14:00:00.000Z",
      attendee: { name: "Dr Alice", email: "alice@example.com", timeZone: "America/Toronto" },
      metadata: { practitioner_id: "p-1", call_record_id: "c-1" },
    },
    { apiKey: "cal_live_test", apiVersion: "2026-02-25", fetchImpl: fakeFetch },
  );

  assertEquals(result.uid, "abc");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://api.cal.com/v2/bookings");
  const headers = new Headers(calls[0].init.headers);
  assertEquals(headers.get("authorization"), "Bearer cal_live_test");
  assertEquals(headers.get("cal-api-version"), "2026-02-25");
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
        { apiKey: "k", apiVersion: "2026-02-25", fetchImpl: fakeFetch },
      ),
    CalError,
    "slot taken",
  );
});

Deno.test("listCalBookings assembles query params and unwraps data array", async () => {
  const requested: string[] = [];
  const fakeFetch: typeof fetch = async (url) => {
    requested.push(String(url));
    return new Response(
      JSON.stringify({
        status: "success",
        data: [
          { id: 1, uid: "a", status: "accepted" },
          { id: 2, uid: "b", status: "cancelled" },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const { bookings } = await listCalBookings(
    { afterStart: "2026-05-01T00:00:00.000Z", beforeStart: "2026-05-08T00:00:00.000Z", status: "upcoming", take: 50 },
    { apiKey: "k", apiVersion: "2026-02-25", fetchImpl: fakeFetch },
  );

  assertEquals(bookings.length, 2);
  assertEquals(bookings[0].uid, "a");
  assertEquals(requested.length, 1);
  const url = new URL(requested[0]);
  assertEquals(url.origin + url.pathname, "https://api.cal.com/v2/bookings");
  assertEquals(url.searchParams.get("afterStart"), "2026-05-01T00:00:00.000Z");
  assertEquals(url.searchParams.get("beforeStart"), "2026-05-08T00:00:00.000Z");
  assertEquals(url.searchParams.get("status"), "upcoming");
  assertEquals(url.searchParams.get("take"), "50");
});

Deno.test("listCalBookings unwraps nested data.bookings envelope", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ status: "success", data: { bookings: [{ id: 9, uid: "z", status: "accepted" }] } }),
      { status: 200 },
    );
  const { bookings } = await listCalBookings({}, { apiKey: "k", fetchImpl: fakeFetch });
  assertEquals(bookings.length, 1);
  assertEquals(bookings[0].uid, "z");
});

Deno.test("normalizeCalStatus maps cal v2 statuses to canonical AppointmentStatus", () => {
  assertEquals(normalizeCalStatus("accepted"), "confirmed");
  assertEquals(normalizeCalStatus("ACCEPTED"), "confirmed");
  assertEquals(normalizeCalStatus("Rescheduled"), "rescheduled");
  assertEquals(normalizeCalStatus("no_show"), "no_show");
  assertEquals(normalizeCalStatus("no-show"), "no_show");
  assertEquals(normalizeCalStatus("canceled"), "cancelled");
  assertEquals(normalizeCalStatus("cancelled"), "cancelled");
  assertEquals(normalizeCalStatus("pending"), "scheduled");
  assertEquals(normalizeCalStatus("completed"), "completed");
  assertEquals(normalizeCalStatus(undefined), "scheduled");
  assertEquals(normalizeCalStatus(null), "scheduled");
  assertEquals(normalizeCalStatus(""), "scheduled");
  assertEquals(normalizeCalStatus("something_new"), "scheduled");
});

Deno.test("createCalBooking surfaces attendees, metadata, createdAt, updatedAt, title", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        status: "success",
        data: {
          id: 42,
          uid: "xyz-42",
          status: "accepted",
          start: "2026-05-12T15:00:00.000Z",
          end: "2026-05-12T15:30:00.000Z",
          title: "SuperPatch Demo",
          attendees: [
            { name: "Dr B", email: "b@clinic.ca", timeZone: "America/Toronto" },
          ],
          metadata: { practitioner_id: "p-2" },
          createdAt: "2026-05-11T10:00:00.000Z",
          updatedAt: "2026-05-11T10:05:00.000Z",
        },
      }),
      { status: 201 },
    );

  const result = await createCalBooking(
    {
      eventTypeId: 1,
      start: "2026-05-12T15:00:00.000Z",
      attendee: { name: "Dr B", email: "b@clinic.ca", timeZone: "America/Toronto" },
    },
    { apiKey: "k", fetchImpl: fakeFetch },
  );

  assertEquals(result.uid, "xyz-42");
  assertEquals(result.title, "SuperPatch Demo");
  assertEquals(result.attendees?.length, 1);
  assertEquals(result.attendees?.[0]?.email, "b@clinic.ca");
  assertEquals(result.metadata?.practitioner_id, "p-2");
  assertEquals(result.createdAt, "2026-05-11T10:00:00.000Z");
  assertEquals(result.updatedAt, "2026-05-11T10:05:00.000Z");
});
