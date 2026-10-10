/**
 * WikiOS standalone mode: WikiOS runs as its own lean Next.js process that owns
 * ixwiki.com/wiki/* (plan 417), the same way IxWorld owns maps.ixwiki.com.
 *
 * NEXT_PUBLIC_WIKIOS_STANDALONE is a build-time flag (set by scripts/deploy-wikios.sh and in the
 * PM2 ecosystem file), so `isWikiStandalone()` is safe to call from the proxy and from pages.
 */

import { toRouterPath, withBasePath } from "~/lib/base-path";

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
 * - /images/uploads: pictures uploaded in IxStates (a country's flag is stored as `/images/uploads/<file>`, shown
 *   by the Main Page's country grid, src/components/wiki-os/reader/main/SculptedMainPageContent.tsx). WikiOS serves
 *   them from its own public/images/uploads, which scripts/deploy-wikios.sh links to IxStates's. MediaWiki's own
 *   uploads (`/images/<a>/<ab>/<File>`, `/images/thumb/...`) are not WikiOS's: nginx sends those to MediaWiki.
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
  "/images/uploads",
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

/** `NEXT_PUBLIC_IXSTATES_URL` without its trailing slash, or null when it is not set. */
function configuredIxstatesUrl(): string | null {
  return process.env.NEXT_PUBLIC_IXSTATES_URL?.trim().replace(/\/+$/, "") || null;
}

function ixstatesBaseUrl(): string {
  const configured = configuredIxstatesUrl();
  if (!configured) throw new WikiStandaloneConfigError();
  return configured;
}

const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/]+/i;

/**
 * The `href` of a route that belongs to IxStates, not to the wiki (`/blurbs`, `/mycountry`, `/dashboard`,
 * `/countries`, `/achievements`, `/messages`, `/maps`, ...): `withBasePath(path)` inside IxStates, where the
 * route is served on the same host, and the absolute IxStates URL in the standalone WikiOS build, which
 * serves none of them (a relative link would only bounce through the guard's redirect). An absolute URL
 * stays as it is, and so does a path that already starts with the IxStates URL's own path
 * (`/projects/ixstates/...`). A standalone build with no NEXT_PUBLIC_IXSTATES_URL keeps the relative link:
 * the guard then reports the missing configuration (`WikiStandaloneConfigError`) instead of a link failing the
 * render of every page.
 */
export function ixstatesHref(path: string): string {
  const base = ABSOLUTE_URL.test(path) || !isWikiStandalone() ? null : configuredIxstatesUrl();
  if (!base) return withBasePath(path);
  const rooted = path.startsWith("/") ? path : `/${path}`;
  const basePath = base.replace(ORIGIN, "");
  return `${base}${basePath && rooted.startsWith(`${basePath}/`) ? rooted.slice(basePath.length) : rooted}`;
}

/**
 * An IxStates path as Next's `<Link href>` and router take it. `ixstatesHref` puts the deployment's base path on a relative
 * path, and `<Link>` adds the base path itself without checking for one, so the prefix is taken off again (once;
 * `/` stays `/`, never the empty string). An absolute URL (a standalone WikiOS build links to IxStates by its full
 * address) stays as it is, and so does a path when the deployment has no base path. A plain `<a href>` takes
 * `ixstatesHref` directly; only `<Link>` takes this.
 */
export function ixstatesLinkHref(path: string): string {
  return toRouterPath(ixstatesHref(path));
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
