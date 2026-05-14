// Pure decision function for webhook-processor idempotency. Extracted from
// index.ts so the short-circuit logic is unit-testable without booting the
// full handler.
//
// Bland.ai redelivers webhook events on network errors or missed acks. Without
// this guard we would re-fire ALL side effects (create a duplicate
// sample_request row, re-dispatch book-appointment, re-trigger analyze-call,
// re-schedule retries).
//
// The decision is intentionally simple: if the call_records row for this
// call_id already has `processed_at` set, the previous delivery completed
// far enough to claim success. We honor that and short-circuit. See the
// matching comment in index.ts for the trade-off around downstream-failure
// retries.

export interface IdempotencyInput {
  call_id?: string | null;
  existing?: {
    id?: string | null;
    processed_at?: string | null;
  } | null;
}

export type IdempotencyDecision =
  | { skip: true; reason: "already_processed"; recordId: string | null; processedAt: string }
  | { skip: false; reason: "no_call_id" | "no_existing_row" | "not_yet_processed" };

export function decideIdempotency(input: IdempotencyInput): IdempotencyDecision {
  if (!input.call_id) {
    return { skip: false, reason: "no_call_id" };
  }
  if (!input.existing) {
    return { skip: false, reason: "no_existing_row" };
  }
  if (!input.existing.processed_at) {
    return { skip: false, reason: "not_yet_processed" };
  }
  return {
    skip: true,
    reason: "already_processed",
    recordId: input.existing.id ?? null,
    processedAt: input.existing.processed_at,
  };
}
