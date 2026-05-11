// Notes-field helper for book-appointment. Thin wrapper around the
// generic `_shared/notes.ts:appendNoteLine` so the call-records notes
// append behaviour stays identical across all Edge Functions.

import { appendNoteLine } from "../_shared/notes.ts";

/**
 * Builds an updated `call_records.notes` value that preserves prior notes
 * (call summaries from analyze-call, agent annotations, prior booking
 * lines) and appends a single canonical `Cal.com Booking ID: <uid>` line.
 * Idempotent: re-running with the same booking ID does not duplicate the
 * line.
 */
export function buildNotesUpdate(
  prior: string | null | undefined,
  calBookingUid: string,
): string {
  return appendNoteLine(prior, `Cal.com Booking ID: ${calBookingUid}`);
}
