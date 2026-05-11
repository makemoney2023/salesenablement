// Notes-field helper for book-appointment. Lives in its own module so
// the (very small) call surface can be exercised in isolation from the
// rest of the Edge Function.

/**
 * Builds an updated `call_records.notes` value that preserves prior notes
 * (call summaries from analyze-call, agent annotations, prior booking
 * lines) and appends a single canonical `Cal.com Booking ID: <uid>` line.
 * Idempotent: re-running with the same booking ID does not duplicate the
 * line.
 */
export function buildNotesUpdate(prior: string | null | undefined, calBookingUid: string): string {
  const line = `Cal.com Booking ID: ${calBookingUid}`;
  if (!prior || !prior.trim()) return line;
  if (prior.includes(line)) return prior;
  return `${prior.trimEnd()}\n${line}`;
}
