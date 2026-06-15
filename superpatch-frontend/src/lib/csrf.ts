/**
 * Lightweight CSRF / same-origin enforcement for state-changing API
 * routes that do not already use a CSRF token middleware.
 *
 * Pattern: every state-changing POST/DELETE handler that does NOT
 * require a bearer token (i.e. relies on the Supabase auth cookie)
 * must verify that the `Origin` header matches our deployment's site
 * URL. Without this, a malicious site can POST to e.g.
 * `/api/auth/signout` with the user's cookies attached and log them
 * out without their consent.
 *
 * We accept origins that match either:
 *  - `process.env.NEXT_PUBLIC_SITE_URL` (production / preview)
 *  - `http://localhost:3000` and `http://127.0.0.1:3000` (local dev)
 *
 * `null` Origin (e.g. browser direct navigation, server-to-server)
 * is rejected — state-changing endpoints should be called from real
 * web origins.
 */

const LOCAL_DEV_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export interface OriginCheckOptions {
  /** The Origin header value as observed on the incoming request. */
  origin: string | null;
  /**
   * The site URL we treat as the canonical first-party origin (usually
   * `process.env.NEXT_PUBLIC_SITE_URL`). Optional — if unset, only
   * localhost is accepted.
   */
  siteUrl?: string | null | undefined;
}

export type OriginCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing_origin" | "mismatched_origin" };

function normalizeOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // protocol + host only; ignore path/query so trailing slashes etc. are fine.
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function isSameOrigin({ origin, siteUrl }: OriginCheckOptions): OriginCheckResult {
  if (!origin) {
    return { ok: false, reason: "missing_origin" };
  }
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin) {
    return { ok: false, reason: "mismatched_origin" };
  }
  const allowed = new Set<string>(LOCAL_DEV_ORIGINS);
  const normSite = normalizeOrigin(siteUrl);
  if (normSite) allowed.add(normSite);
  return allowed.has(normOrigin) ? { ok: true } : { ok: false, reason: "mismatched_origin" };
}
