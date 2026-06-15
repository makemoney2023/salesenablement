/**
 * 5xx response sanitization for Next.js API routes.
 *
 * Mirrors the Edge Function helper at
 * `supabase/functions/_shared/sanitize-error.ts`. Kept here as a
 * separate copy (rather than importing the Deno file) because the
 * Next.js + Vite/Vitest build can't resolve the Deno URL imports the
 * Edge Function file uses.
 *
 * USAGE:
 *
 *   try { ... }
 *   catch (error) {
 *     console.error("Failed to ...", error);
 *     return NextResponse.json(
 *       sanitizeApiError(error, { code: "campaign_get_failed" }),
 *       { status: 500 },
 *     );
 *   }
 *
 * The returned object is `{ status: "error", code, message }`. The
 * `status: "error"` discriminator is kept for backward compatibility
 * with existing client code; `code` and `message` are the new safe
 * fields. The full underlying error is NEVER serialized into the
 * response — it should be logged server-side before this is called.
 */

export interface ApiErrorBody {
  status: "error";
  code: string;
  message: string;
}

export interface SanitizeApiErrorOptions {
  /** Stable enum-like code shipped to the client. Defaults to "internal_error". */
  code?: string;
  /** Optional safe message override. Defaults to a generic string. */
  clientMessage?: string;
}

const DEFAULT_MESSAGE = "An internal error occurred. Please contact support.";

export function sanitizeApiError(
  _error: unknown,
  options: SanitizeApiErrorOptions = {},
): ApiErrorBody {
  // The error is intentionally not read — log it at the call-site.
  return {
    status: "error",
    code: options.code ?? "internal_error",
    message: options.clientMessage ?? DEFAULT_MESSAGE,
  };
}
