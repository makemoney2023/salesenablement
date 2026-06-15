/**
 * Do-Not-Call (DNC) phrase detection for call transcripts.
 *
 * Extracted from index.ts so the phrase list and matcher are unit-testable.
 *
 * IMPORTANT: only phrases that are an UNAMBIGUOUS request to stop being
 * contacted belong here. A generic sales objection like "not interested" is
 * NOT a DNC request — flagging it legally removes a prospect from all future
 * outreach, which is too aggressive and was causing false positives.
 */
export const DNC_PHRASES = [
  "don't call",
  "do not call",
  "stop calling",
  "remove me",
  "take me off",
  "never call again",
  "unsubscribe",
  "remove my number",
  "don't contact",
  "do not contact",
  "no more calls",
  "quit calling",
];

export function detectDNCRequest(
  transcript: string
): { detected: boolean; matchedPhrase: string | null } {
  if (!transcript) return { detected: false, matchedPhrase: null };
  const lowerTranscript = transcript.toLowerCase();
  for (const phrase of DNC_PHRASES) {
    if (lowerTranscript.includes(phrase)) {
      console.log(`🚫 DNC phrase detected: "${phrase}"`);
      return { detected: true, matchedPhrase: phrase };
    }
  }
  return { detected: false, matchedPhrase: null };
}
