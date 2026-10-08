/**
 * Realm invite links (`/r/{slug}?via={handle}`): the `via` a page reads from its URL, and paths that carry it
 * on (claims, sign-in redirects, the passport's Join link). Client-safe, no I/O.
 */

/** Longest `via` a page passes on; the claim procedures drop anything longer. */
export const MAX_VIA_LENGTH = 100;

/** The invite handle a `via` query value carries, trimmed; null when absent, blank or too long. */
export function inviteVia(raw: string | null | undefined): string | null {
  const via = raw?.trim() ?? "";
  return via && via.length <= MAX_VIA_LENGTH ? via : null;
}

/** `path` with `via` added to its query string; `path` unchanged without a via. */
export function withVia(path: string, via: string | null | undefined): string {
  if (!via) return path;
  return `${path}${path.includes("?") ? "&" : "?"}via=${encodeURIComponent(via)}`;
}
