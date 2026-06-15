// 5xx response sanitization for Edge Functions and Next.js API routes.
//
// Raw `String(error)` in a 500-response body leaks the underlying
// PostgreSQL error string, internal hostnames, dependency stack frames,
// auth/signature failure detail, and similar internals to whoever
// happens to be making the request. None of that helps the legitimate
// caller (Bland.ai gets nothing actionable from a Postgres error); it
// ONLY helps attackers reconnoiter our stack.
//
// Pattern: log the FULL error server-side (see callers), and return a
// stable {code, message} object to the client. The `code` is enum-like
// and safe to ship; `message` is a generic operator-friendly string.
//
// If you want a more specific client-facing message (e.g. "appointment
// time could not be parsed"), pass `clientMessage` and we'll use that
// instead. Never pass user-derived strings or raw error.message values
// as `clientMessage`.

export interface SanitizeOptions {
  /** Stable enum-like code shipped to the client. Defaults to "internal_error". */
  code?: string;
  /** Optional safe message override. Defaults to the generic string below. */
  clientMessage?: string;
}

export interface SanitizedError {
  code: string;
  message: string;
}

const DEFAULT_MESSAGE = "An internal error occurred. Please contact support.";

export function sanitizeError(
  _error: unknown,
  options: SanitizeOptions = {},
): SanitizedError {
  // The error is intentionally not used in the return — it should be
  // logged by the caller. We accept it here so the call-site reads
  // naturally: `return Response.json(sanitizeError(err, {code: "x"}))`.
  return {
    code: options.code ?? "internal_error",
    message: options.clientMessage ?? DEFAULT_MESSAGE,
  };
}
