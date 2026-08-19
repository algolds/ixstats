/**
 * Runtime hostname-based detection for IxWorld standalone mode.
 *
 * Replaces the build-time NEXT_PUBLIC_IXWORLD_STANDALONE env var so that
 * a single Next.js build can serve both ixstates.ixwiki.com (full app)
 * and maps.ixwiki.com (maps-only standalone).
 */

const STANDALONE_HOSTNAME = "maps.ixwiki.com";

/** Server-side: check the incoming request hostname. */
export function isStandaloneRequest(headers: Headers): boolean {
  if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") return true;
  const host = headers.get("x-forwarded-host") || headers.get("host") || "";
  return host.startsWith(STANDALONE_HOSTNAME);
}

/** Client-side: check window.location.hostname. */
export function isStandaloneClient(): boolean {
  if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") return true;
  if (typeof window === "undefined") return false;
  return window.location.hostname === STANDALONE_HOSTNAME;
}
