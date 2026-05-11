// Coercion helpers for webhook payloads from Bland.ai. Bland sends
// boolean-like values in three different shapes depending on how a
// pathway captured them: native booleans, strings ("true"/"false"/"yes"),
// or numbers (1/0). Each call site was rolling its own coercion (often
// missing the case where the value is `undefined`, which crashes
// `.toLowerCase()`), so this module centralizes the policy.

/**
 * Coerces an unknown webhook value to a boolean. Returns false for any
 * value that doesn't unambiguously represent truthiness:
 * - true                              -> true
 * - "true" / "TRUE" / "yes" / "y"     -> true
 * - "1"                               -> true
 * - any non-zero number               -> true
 * - everything else (false, null,
 *   undefined, "", 0, NaN, "foo"...)  -> false
 *
 * Crucially: this never throws on `null`/`undefined`/numbers, so it is
 * safe to call directly on `vars.<field>` for any webhook variable.
 */
export function toBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed === "true" || trimmed === "yes" || trimmed === "y" || trimmed === "1";
  }
  return false;
}
