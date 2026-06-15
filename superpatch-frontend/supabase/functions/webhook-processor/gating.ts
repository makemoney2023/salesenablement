/**
 * Pure side-effect gating decisions for the webhook processor.
 *
 * Extracted so the rules that decide whether to create a sample request or
 * dispatch a booking are unit-testable in isolation from the large request
 * handler.
 */

/**
 * Whether a sample request should be created/sent.
 *
 * A Do Not Call detection short-circuits ALL fulfilment side effects, so a
 * caller who asked to be removed never receives samples even if the AI also
 * captured a sample intent earlier in the same call.
 */
export function shouldInsertSample(
  wantsSample: boolean,
  dncDetected: boolean
): boolean {
  return wantsSample && !dncDetected;
}

export interface BookingGateInput {
  wantsDemo: boolean;
  hasParsedAppointmentTime: boolean;
  hasPractitionerName: boolean;
  hasEmail: boolean;
  completed: boolean;
  hasSavedRecord: boolean;
  dncDetected: boolean;
  /** call_records.booking_id — set once a booking already exists. */
  existingBookingId?: string | null;
  /** True when an appointments row already references this call record. */
  existingAppointment: boolean;
}

/**
 * Whether the book-appointment Edge Function should be dispatched.
 *
 * Guards (any failing => no dispatch):
 *   - all the required inputs are present (demo intent, parsed time, name,
 *     email, completed call, saved call record)
 *   - the caller did NOT request DNC
 *   - no booking_id is already recorded on the call record (mirrors
 *     book-appointment's own dedup)
 *   - no appointments row already exists for this call record
 */
export function shouldDispatchBooking(input: BookingGateInput): boolean {
  return (
    input.wantsDemo &&
    input.hasParsedAppointmentTime &&
    input.hasPractitionerName &&
    input.hasEmail &&
    input.completed &&
    input.hasSavedRecord &&
    !input.dncDetected &&
    !input.existingBookingId &&
    !input.existingAppointment
  );
}
