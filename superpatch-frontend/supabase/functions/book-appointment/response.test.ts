import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildBookingResponse, type BuildBookingResponseInput } from "./response.ts";

// The booking response was previously returning HTTP 200 + success: true even
// when the appointment-row INSERT failed (appointment_id: null). This made the
// upstream call site (webhook-processor) treat it as success while the new
// /appointments UI / follow-up queue saw nothing. These tests pin the new
// contract: appointment_id null is ALWAYS HTTP 500 with success: false.

const okBooking: BuildBookingResponseInput["booking"] = {
  id: 123,
  uid: "abc",
  status: "ACCEPTED",
  start: "2026-06-01T10:00:00Z",
  end: "2026-06-01T10:30:00Z",
};

Deno.test("buildBookingResponse returns 200 success when both Cal and DB succeed", async () => {
  const response = buildBookingResponse({
    booking: okBooking,
    appointmentId: "appt-1",
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.appointment_id, "appt-1");
  assertEquals(body.booking.uid, "abc");
});

Deno.test("buildBookingResponse returns 500 partial-failure when appointment_id is null", async () => {
  const response = buildBookingResponse({
    booking: okBooking,
    appointmentId: null,
  });
  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.success, false);
  // The booking detail should still be surfaced so ops can find the Cal event
  // even though our DB row is missing.
  assertEquals(body.booking.uid, "abc");
  // The error message must be explicit so the caller (webhook-processor)
  // surfaces a useful failure reason in its own logs.
  assertEquals(
    typeof body.error === "string" && body.error.includes("appointment"),
    true,
  );
});

Deno.test("buildBookingResponse includes CORS headers in both paths", () => {
  const ok = buildBookingResponse({ booking: okBooking, appointmentId: "x" });
  assertEquals(ok.headers.get("Content-Type"), "application/json");
  assertEquals(ok.headers.get("Access-Control-Allow-Origin"), "*");

  const fail = buildBookingResponse({ booking: okBooking, appointmentId: null });
  assertEquals(fail.headers.get("Content-Type"), "application/json");
  assertEquals(fail.headers.get("Access-Control-Allow-Origin"), "*");
});
