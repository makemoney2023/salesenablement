// Thin wrapper around the increment_retry_count RPC defined in
// 20260206_add_atomic_retry_increment.sql. Lives in its own module so
// the (very small) call surface can be exercised in isolation from the
// rest of process-retry-queue.

// deno-lint-ignore no-explicit-any
type RpcCapable = { rpc(fn: string, args: Record<string, unknown>): Promise<{ data: any; error: any }> };

/**
 * Decide whether a manual retry trigger (POST with practitionerIds) is allowed
 * to dial. Manual triggers respect business hours just like the cron path,
 * unless the caller explicitly passes { force: true }.
 *
 * Pure so it can be unit-tested without standing up the full handler.
 */
export function shouldProcessManualTrigger(
  force: boolean | undefined,
  withinBusinessHours: boolean,
): boolean {
  if (force === true) return true;
  return withinBusinessHours;
}

export class IncrementRetryError extends Error {
  constructor(message: string, public override cause?: unknown) {
    super(message);
    this.name = "IncrementRetryError";
  }
}

/**
 * Atomically increments practitioners.retry_count for the given id and
 * returns the new value. Throws IncrementRetryError on RPC failure so the
 * caller can decide whether to skip this practitioner or surface the error.
 */
export async function incrementRetry(
  client: RpcCapable,
  practitionerId: string,
): Promise<number> {
  const { data, error } = await client.rpc("increment_retry_count", {
    p_id: practitionerId,
  });
  if (error) {
    throw new IncrementRetryError(
      `increment_retry_count RPC failed for practitioner ${practitionerId}`,
      error,
    );
  }
  if (data === null || data === undefined) {
    throw new IncrementRetryError(
      `increment_retry_count returned no value for practitioner ${practitionerId}`,
    );
  }
  return Number(data);
}
