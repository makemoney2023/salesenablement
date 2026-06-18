import { describe, it, expect } from "vitest";
import { needsPostCallBooking } from "../_shared/booking-gate.ts";

describe("needsPostCallBooking", () => {
  it("skips post-call booking when in-call uid present", () => {
    expect(needsPostCallBooking({ inCallBookingUid: "uid_123", existingBookingId: null })).toBe(false);
  });
  it("skips when a booking_id already exists", () => {
    expect(needsPostCallBooking({ inCallBookingUid: null, existingBookingId: "bk_1" })).toBe(false);
  });
  it("dispatches when neither exists", () => {
    expect(needsPostCallBooking({ inCallBookingUid: null, existingBookingId: null })).toBe(true);
  });
});
