/**
 * WikiOS standalone mode: WikiOS runs as its own lean Next.js process that owns
 * ixwiki.com/wiki/* (plan 417), the same way IxWorld owns maps.ixwiki.com.
 *
 * NEXT_PUBLIC_WIKIOS_STANDALONE is a build-time flag (set by scripts/deploy-wikios.sh and in the
 * PM2 ecosystem file), so `isWikiStandalone()` is safe to call from the proxy and from pages.
 */

const MAIN_PAGE_PATH = "/wiki/Main_Page";

/** The standalone build cannot redirect to IxStates without NEXT_PUBLIC_IXSTATES_URL. */
export class WikiStandaloneConfigError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_IXSTATES_URL is not set: the WikiOS standalone build needs the IxStates URL " +
        "that works on the server (there is no default; see docs/operations/wikios-v1-cutover.md)"
    );
    this.name = "WikiStandaloneConfigError";
  }
}

/**
 * Request-path prefixes the standalone WikiOS process serves itself. Anything else is IxStates.
 * Keep scripts/ops/nginx/wikios-takeover.conf in step: nginx only forwards what it lists.
 *
 * Runtime requests of WikiOS pages that are not routes (and the code that makes them):
 * - /api/ixtime/current: the IxTime store (src/stores/ixtime-store.ts), mounted on every page by
 *   IxTimeProvider in the root layout.
 * - /api/onoma/tts: the article narrator (src/hooks/useWikiNarrator.ts).
 * - /maplibre: the MapLibre worker of the country and coordinate map embeds
 *   (src/lib/maps/load-maplibre.ts).
 * - /flags and /images/flags: flag files and the flag placeholder (src/lib/flags/local-flag-cache.server.ts,
 *   src/hooks/useUnifiedFlags.ts).
 * - /fonts: National/Akzidenz fonts (src/styles/typography.css) and map glyphs (src/lib/base-path.ts).
 * - /w: `/w/api.php`, WikiOS's MediaWiki-compatible Action API for bots and tools (plan 410,
 *   src/app/w/api.php/route.ts). Without it the standalone guard would answer a bot with a redirect
 *   to the IxStates page of that path.
 */
export const WIKIOS_ALLOWED_PREFIXES: readonly string[] = [
  "/wiki",
  "/w",
  "/util",
  "/stashes",
  "/api/trpc",
  "/api/wiki",
  "/api/wikios",
  "/api/mediawiki",
  "/api/ixtime/current",
  "/api/onoma/tts",
  "/api.php",
  "/sitemap",
  "/robots.txt",
  "/_next",
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/favicon",
  "/wikios-",
  "/fonts",
  "/flags",
  "/maplibre",
  "/images/wikios",
  "/images/flags",
  "/opensearch",
];

export function isWikiStandalone(): boolean {
  return process.env.NEXT_PUBLIC_WIKIOS_STANDALONE === "true";
}

/**
 * A prefix matches on a path-segment boundary ("/wiki" matches "/wiki", "/wiki/Foo", "/wiki.json"
 * but not "/wikipedia"); a prefix that ends in "-" is a file-name prefix ("/wikios-logo.svg").
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) return false;
  if (prefix.endsWith("-")) return true;
  const next = pathname.charAt(prefix.length);
  return next === "" || next === "/" || next === "." || next === "-";
}

function ixstatesBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_IXSTATES_URL?.trim();
  if (!configured) throw new WikiStandaloneConfigError();
  return configured.replace(/\/+$/, "");
}

/**
 * Where a standalone WikiOS request must be redirected, or null when WikiOS serves it.
 * `/` goes to the Main Page; a path outside WIKIOS_ALLOWED_PREFIXES belongs to IxStates.
 * Throws WikiStandaloneConfigError when such a path needs NEXT_PUBLIC_IXSTATES_URL and it is unset.
 */
export function wikiStandaloneRedirect(pathname: string, search: string): string | null {
  if (pathname === "/") return MAIN_PAGE_PATH;
  if (WIKIOS_ALLOWED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return null;
  return `${ixstatesBaseUrl()}${pathname}${search}`;
}
