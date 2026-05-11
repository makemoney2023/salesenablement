// Idempotent append-line helper for `call_records.notes`. Used by every
// Edge Function that writes to this column so a follow-up sync, booking
// retry, or cancel can never clobber the analyze-call summary or a prior
// agent annotation.
//
// Contract:
//   - Returns `line` when `prior` is null / undefined / blank.
//   - Returns `prior` unchanged when it already contains `line` (idempotent
//     re-runs).
//   - Otherwise returns `prior + '\n' + line`, trimming trailing whitespace
//     on `prior` so we don't produce blank-line drift.

export function appendNoteLine(
  prior: string | null | undefined,
  line: string,
): string {
  if (!prior || !prior.trim()) return line;
  if (prior.includes(line)) return prior;
  return `${prior.trimEnd()}\n${line}`;
}
