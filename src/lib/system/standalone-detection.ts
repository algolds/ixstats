/**
 * IxWorld standalone mode and the maps host.
 *
 * Standalone mode (the maps-only build: `/` goes to `/maps`, no setup redirect or mini player, the
 * standalone CSP) is the build's own choice: NEXT_PUBLIC_IXWORLD_STANDALONE, set by
 * scripts/deploy-ixworld.sh. It no longer follows the hostname, because maps.ixwiki.com serves the full
 * IxStates app (2026-10-27).
 *
 * The maps host still matters for one thing: IxWiki embeds its map, country and wiki pages, so the proxy
 * lets ixwiki.com frame them there (isMapsHostRequest).
 */

const MAPS_HOSTNAME = "maps.ixwiki.com";

const standaloneBuild = (): boolean => process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true";

/** Server-side: whether this is the maps-only standalone build. */
export function isStandaloneRequest(_headers: Headers): boolean {
  return standaloneBuild();
}

/** Client-side: whether this is the maps-only standalone build. */
export function isStandaloneClient(): boolean {
  return standaloneBuild();
}

/** Whether the request came in on maps.ixwiki.com (or the standalone build), which IxWiki embeds. */
export function isMapsHostRequest(headers: Headers): boolean {
  if (standaloneBuild()) return true;
  const host = (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0]!.trim();
  // the exact host name, its port dropped: a prefix match would also take maps.ixwiki.com.example.org
  return host.toLowerCase().replace(/:\d+$/, "") === MAPS_HOSTNAME;
}
