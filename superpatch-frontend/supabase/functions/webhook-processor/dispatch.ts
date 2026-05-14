// Structured dispatcher for fan-out calls from webhook-processor to sibling
// Edge Functions (book-appointment, send-sample-confirmation, etc.).
//
// Why this exists: the previous inline `fetchWithTimeout` pattern never
// inspected `response.ok`. A non-2xx upstream (e.g., book-appointment failing
// to insert the appointment row) would resolve normally and webhook-processor
// would respond `record_saved: true` while the appointment / email silently
// failed. This module makes every downstream outcome explicit and impossible
// to overlook.
//
// Invariants:
//   - never throws — every failure mode (HTTP non-2xx, network error,
//     timeout, etc.) is returned as `{ ok: false, reason }`.
//   - reason length is capped so log lines stay bounded.

export type DispatchOk = { ok: true };
export type DispatchFailure = {
  ok: false;
  reason: string;
  httpStatus?: number;
};
export type DispatchResult = DispatchOk | DispatchFailure;

const REASON_MAX_LEN = 400;
const BODY_PREVIEW_LEN = 250;
const DEFAULT_TIMEOUT_MS = 30_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function defaultFetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export interface DispatchOptions {
  url: string;
  bearer: string;
  body: unknown;
  label: string; // for log lines
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function dispatchEdgeFunction(
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const {
    url,
    bearer,
    body,
    label,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl,
  } = opts;

  let response: Response;
  try {
    if (fetchImpl) {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(body),
      });
    } else {
      response = await defaultFetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(body),
      }, timeoutMs);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: truncate(`[${label}] dispatch failed: ${message}`, REASON_MAX_LEN),
    };
  }

  if (response.ok) {
    return { ok: true };
  }

  let preview = "";
  try {
    const text = await response.text();
    preview = truncate(text, BODY_PREVIEW_LEN);
  } catch {
    preview = "(could not read response body)";
  }

  return {
    ok: false,
    httpStatus: response.status,
    reason: truncate(
      `[${label}] HTTP ${response.status}: ${preview}`,
      REASON_MAX_LEN,
    ),
  };
}
