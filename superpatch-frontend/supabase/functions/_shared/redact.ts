// PII redaction helpers for Edge Function logs.
//
// Supabase Edge Function `console.log` / `console.error` output is shipped
// to the Supabase project log bucket. Anyone with project-level "Viewer"
// access (or any leak of those logs to a downstream sink) can read every
// line we emit. Until the previous sweep, we were emitting full names,
// phone numbers, emails, and entire qualification objects to those logs.
//
// This module defines the building blocks for safe logging:
//   - redactPhone(s)       -> "+1**********50" (keeps last 2 + country code)
//   - redactEmail(s)       -> "a****@example.com" (keeps domain + 1 char)
//   - redactName(s)        -> "A. C." (initials only)
//   - redactTranscript(s)  -> "<transcript len=2345>"
//   - redactPii(obj)       -> deep-walks an object and applies the above
//                             based on a case-insensitive key allowlist
//
// Always prefer the *named* helper over a raw value. The object walker
// `redactPii(...)` exists specifically for free-form Bland.ai payloads
// (qualification, variables) where individual keys are not known in
// advance.
//
// The helpers are intentionally cheap (no regex back-references, no
// Unicode normalization) so they're safe to call on every log line.

// Case-insensitive set of field names that should be treated as
// containing PII when walked via redactPii. Extend with care: each
// addition must have a matching redactor selected in `redactByKey`.
const PII_KEYS: Record<string, "phone" | "email" | "name" | "address" | "drop"> = {
  // Phone-ish
  phone: "phone",
  phone_number: "phone",
  callee: "phone",
  to: "phone",
  caller: "phone",
  from: "phone",
  // Email-ish
  email: "email",
  contact_email: "email",
  practitioner_email: "email",
  recipient_email: "email",
  // Name-ish
  name: "name",
  full_name: "name",
  first_name: "name",
  last_name: "name",
  contact_name: "name",
  practitioner_name: "name",
  fullname: "name",
  // Address-ish (drop entirely; no useful shape)
  address: "address",
  street: "address",
  street_address: "address",
  // Free-text fields that almost always carry PII; emit a marker only.
  transcript: "drop",
  concatenated_transcript: "drop",
  summary: "drop",
  notes: "drop",
  qualification: "drop",
  qualification_data: "drop",
};

export function redactPhone(value: string | null | undefined): string {
  if (value === null || value === undefined) return "<null>";
  if (value === "") return "<empty>";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 3) return "<short>";
  const last2 = digits.slice(-2);
  const masked = "*".repeat(Math.max(0, digits.length - 2));
  // Preserve a leading + and the country-code digit(s) if present, so
  // operators can tell US/CA (+1) apart from intl numbers in logs.
  if (value.trim().startsWith("+") && digits.length > 10) {
    const cc = digits.slice(0, digits.length - 10);
    return `+${cc}${"*".repeat(10 - 2)}${last2}`;
  }
  return `${masked}${last2}`;
}

export function redactEmail(value: string | null | undefined): string {
  if (value === null || value === undefined) return "<null>";
  if (value === "") return "<empty>";
  const atIdx = value.indexOf("@");
  if (atIdx <= 0 || atIdx === value.length - 1) return "<invalid-email>";
  const local = value.slice(0, atIdx);
  const domain = value.slice(atIdx + 1);
  const firstChar = local.charAt(0).toLowerCase();
  return `${firstChar}****@${domain}`;
}

export function redactName(value: string | null | undefined): string {
  if (value === null || value === undefined) return "<null>";
  if (value === "") return "<empty>";
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "<empty>";
  return words.map((w) => `${w.charAt(0).toUpperCase()}.`).join(" ");
}

export function redactTranscript(value: string | null | undefined): string {
  if (value === null || value === undefined) return "<null>";
  if (value === "") return "<empty>";
  return `<transcript len=${value.length}>`;
}

function redactAddress(_value: unknown): string {
  return "<redacted>";
}

// deno-lint-ignore no-explicit-any
function redactValueByKind(kind: string, value: any): any {
  switch (kind) {
    case "phone":
      return typeof value === "string" ? redactPhone(value) : "<non-string>";
    case "email":
      return typeof value === "string" ? redactEmail(value) : "<non-string>";
    case "name":
      return typeof value === "string" ? redactName(value) : "<non-string>";
    case "address":
      return redactAddress(value);
    case "drop":
      if (typeof value === "string") {
        return value.length === 0 ? "<empty>" : `<redacted len=${value.length}>`;
      }
      if (value === null || value === undefined) return "<null>";
      return "<redacted>";
    default:
      return value;
  }
}

// deno-lint-ignore no-explicit-any
export function redactPii(input: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactPii(item));
  }
  // deno-lint-ignore no-explicit-any
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    const kind = PII_KEYS[key.toLowerCase()];
    if (kind) {
      out[key] = redactValueByKind(kind, value);
    } else if (value !== null && typeof value === "object") {
      out[key] = redactPii(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
