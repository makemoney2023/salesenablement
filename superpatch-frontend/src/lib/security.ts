/**
 * Security utilities for the application.
 */

/**
 * Validate redirect path to prevent open redirect attacks.
 * Only allows relative paths starting with '/' that don't redirect to external sites.
 */
export function sanitizeRedirectPath(path: string | null): string {
  if (!path) return '/';
  // Must start with '/' and must NOT start with '//' (protocol-relative URL)
  // Must not contain backslash (some browsers normalize \ to /)
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/';
  }
  // Strip any protocol attempts (e.g., /\x00javascript:)
  try {
    const url = new URL(path, 'http://localhost');
    if (url.hostname !== 'localhost') return '/';
  } catch {
    return '/';
  }
  return path;
}

/**
 * Sanitize search input for use in PostgREST ilike queries.
 * Escapes wildcards and removes filter syntax characters.
 */
export function sanitizeSearchInput(search: string, maxLength = 200): string {
  return search
    .replace(/[%_\\]/g, '\\$&')  // Escape wildcards and backslash
    .replace(/[,()]/g, '')        // Remove PostgREST filter syntax chars
    .slice(0, maxLength);          // Limit length
}
