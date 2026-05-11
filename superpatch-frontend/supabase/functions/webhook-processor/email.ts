// Final email-validation gate used when persisting to `sample_requests`.
// webhook-processor already runs sanitizeTranscribedEmail() against the
// individual sources during resolution, but the final
// `email: resolvedEmail || null` was writing whatever survived the
// sanitization. This helper enforces (a) the canonical priority
// form > db > AI, and (b) a final regex pass so we never persist a
// value that isn't shaped like an email.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export interface SampleEmailArgs {
  /** AI-extracted email from the Bland.ai pathway / transcript. */
  aiEmail: string | null | undefined;
  /** Email captured on the original web/CRM form (most trustworthy). */
  formEmail: string | null | undefined;
  /** Email already on the practitioner row in Supabase. */
  dbEmail: string | null | undefined;
}

/**
 * Returns the first valid email in the priority order
 *   formEmail > dbEmail > aiEmail
 * or null if none of them survive validation.
 */
export function pickSampleEmail({ aiEmail, formEmail, dbEmail }: SampleEmailArgs): string | null {
  return cleanEmail(formEmail) ?? cleanEmail(dbEmail) ?? cleanEmail(aiEmail);
}
