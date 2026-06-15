import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { shouldDispatchBooking, shouldInsertSample } from "./gating.ts";

Deno.test("shouldInsertSample requires sample intent and no DNC", () => {
  assertEquals(shouldInsertSample(true, false), true);
  assertEquals(shouldInsertSample(true, true), false); // DNC blocks samples
  assertEquals(shouldInsertSample(false, false), false);
});

const baseBooking = {
  wantsDemo: true,
  hasParsedAppointmentTime: true,
  hasPractitionerName: true,
  hasEmail: true,
  completed: true,
  hasSavedRecord: true,
  dncDetected: false,
  existingBookingId: null as string | null,
  existingAppointment: false,
};

Deno.test("shouldDispatchBooking returns true when all conditions met", () => {
  assertEquals(shouldDispatchBooking({ ...baseBooking }), true);
});

Deno.test("shouldDispatchBooking blocks on DNC", () => {
  assertEquals(
    shouldDispatchBooking({ ...baseBooking, dncDetected: true }),
    false,
  );
});

Deno.test("shouldDispatchBooking blocks when booking_id already set", () => {
  assertEquals(
    shouldDispatchBooking({ ...baseBooking, existingBookingId: "cal_123" }),
    false,
  );
});

Deno.test("shouldDispatchBooking blocks when an appointment already exists", () => {
  assertEquals(
    shouldDispatchBooking({ ...baseBooking, existingAppointment: true }),
    false,
  );
});

Deno.test("shouldDispatchBooking blocks when required fields missing", () => {
  assertEquals(
    shouldDispatchBooking({ ...baseBooking, hasEmail: false }),
    false,
  );
  assertEquals(
    shouldDispatchBooking({ ...baseBooking, hasParsedAppointmentTime: false }),
    false,
  );
  assertEquals(
    shouldDispatchBooking({ ...baseBooking, completed: false }),
    false,
  );
});

// Booking-incentive contract: when a demo is booked the Schedule Appointment
// node sets wants_sample="true" (the $200 demo-booking incentive), so the
// webhook must BOTH dispatch the booking AND insert the sample request from
// the same call. These two gates fire independently off the same payload.
Deno.test("booking triggers the $200 sample: both gates fire together", () => {
  const wantsSample = true; // forced by Schedule Appointment staticVars
  assertEquals(shouldDispatchBooking({ ...baseBooking }), true);
  assertEquals(shouldInsertSample(wantsSample, baseBooking.dncDetected), true);
});

Deno.test("DNC on a booking call suppresses both the booking and the $200 sample", () => {
  const dnc = true;
  assertEquals(shouldDispatchBooking({ ...baseBooking, dncDetected: dnc }), false);
  assertEquals(shouldInsertSample(true, dnc), false);
});
