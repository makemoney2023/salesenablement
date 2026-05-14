// Authentication gate for the Bland.ai webhook receiver.
//
// Bland delivers POSTs anonymously (verify_jwt=false in supabase/config.toml),
// so this gate is the ONLY thing between the public internet and our DB writes.
// It MUST fail closed: every error path returns ok=false.
//
// Bland signs payloads with HMAC-SHA256(body, secret) and sends the hex digest
// in the `x-webhook-signature` header (per
// https://docs.bland.ai/tutorials/webhook-signing).

export type AuthFailureReason =
  | "secret_not_configured"
  | "signature_missing"
  | "signature_mismatch"
  | "verification_error";

export interface AuthResult {
  ok: boolean;
  reason?: AuthFailureReason;
}

/**
 * Sign a payload with HMAC-SHA256 and return a hex digest. Exposed for tests;
 * production code only calls verifyRequestAuth.
 */
export async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a Bland webhook request. Fail-closed:
 *   - missing/empty secret  -> reject ("secret_not_configured")
 *   - missing/empty header  -> reject ("signature_missing")
 *   - any signature error   -> reject ("verification_error")
 *   - mismatched signature  -> reject ("signature_mismatch")
 *   - matched signature     -> accept (ok=true)
 */
export async function verifyRequestAuth(
  secret: string | undefined,
  signature: string | null,
  body: string,
): Promise<AuthResult> {
  if (!secret) {
    return { ok: false, reason: "secret_not_configured" };
  }
  if (!signature) {
    return { ok: false, reason: "signature_missing" };
  }

  let expected: string;
  try {
    expected = await signPayload(secret, body);
  } catch (_err) {
    return { ok: false, reason: "verification_error" };
  }

  // Timing-safe equality. We never short-circuit on length because that itself
  // is a (small) side channel; instead we compare with `result |= a^b` and only
  // *also* require length equality at the end.
  let lengthOk = expected.length === signature.length;
  const compareLength = Math.max(expected.length, signature.length);
  let acc = 0;
  for (let i = 0; i < compareLength; i++) {
    const a = expected.charCodeAt(i) || 0;
    const b = signature.charCodeAt(i) || 0;
    acc |= a ^ b;
  }

  if (acc === 0 && lengthOk) {
    return { ok: true };
  }
  return { ok: false, reason: "signature_mismatch" };
}
