/**
 * Per-wiki configuration for the MediaWiki proxy routes.
 *
 * `[wiki]/api.php` proxies read-only API calls for every wiki here.
 * `[wiki]/[...path]` proxies media for the external wikis; the local ixwiki media
 * route (`ixwiki/[...path]`) keeps its own handler because it also registers assets.
 * Static segments win over `[wiki]` in Next.js routing. Both media routes are image-only
 * (see `_media-response.ts`). The sister wikis' entries are built from `~/lib/wiki-os/wiki-hosts.ts`: adding a
 * wiki there adds it here.
 */
import {
  DEFAULT_USER_AGENT,
  getMediaWikiApiUrl,
  mediaWikiApiUrl,
  mediaWikiOrigin,
  wikiosConfig,
} from "~/lib/wiki-os/config";
import {
  SISTER_READER_IDS,
  SISTER_WIKI_HOSTS,
  SISTER_WIKI_IDS,
  sisterWikiApiUrl,
  type SisterReaderId,
  type SisterWikiHost,
  type SisterWikiId,
} from "~/lib/wiki-os/wiki-hosts";

/** The one user agent every wiki request sends (`DEFAULT_USER_AGENT`, which the sister wikis allow-list). */
export const WIKI_USER_AGENT = DEFAULT_USER_AGENT;

export interface WikiConfig {
  /** Log prefix. */
  label: string;
  /** Base URL for direct sub-path fetches (media, Special:* pages). */
  siteUrl: string;
  /** api.php URL used by the `api.php` proxy. */
  apiUrl: () => string;
  /** api.php URL used to resolve `Special:FilePath` via `imageinfo` (may differ, e.g. iiwiki dev proxy). */
  imageInfoApiUrl: () => string;
  /** Origins allowed to call the api.php proxy cross-origin; `"*"` lets any origin call it. */
  corsOrigins: readonly string[];
  /** Read-only MediaWiki actions the api.php proxy will forward. */
  allowedActions: readonly string[];
  /** Retries (with back-off) when `imageinfo` resolution answers 403. */
  resolveRetries: number;
  /** Sub-path prefix whose files are fetched through wsrv.nl instead of the origin. */
  directImagePrefix?: string;
}

const DEV_ORIGINS =
  process.env.NODE_ENV === "development" ? ["http://localhost:3000", "http://localhost:3550"] : [];

const READ_ACTIONS = ["query", "opensearch", "parse"] as const;

export const WIKIS = {
  ixwiki: {
    label: "IxWiki",
    siteUrl: mediaWikiOrigin(),
    // Server-side calls take the internal (same-server) api.php when WIKIOS_MEDIAWIKI_INTERNAL_URL is set.
    apiUrl: () => mediaWikiApiUrl({ internal: true }),
    imageInfoApiUrl: () => mediaWikiApiUrl({ internal: true }),
    corsOrigins: [mediaWikiOrigin(), `https://www.${wikiosConfig.publicHost}`, ...DEV_ORIGINS],
    // None: WikiOS answers an IxWiki api.php itself (`/w/api.php`, from its own pages), and this proxy would
    // hand outside callers MediaWiki's copy of a page WikiOS has deleted. Only the media proxy
    // (`ixwiki/[...path]`, image files) still reaches IxWiki's MediaWiki from here.
    allowedActions: [],
    resolveRetries: 0,
  },
  // The sister wikis, one per entry of wiki-hosts.ts.
  ...(Object.fromEntries(
    SISTER_WIKI_IDS.map((id): [SisterWikiId, WikiConfig] => [id, sisterWikiConfig(id)])
  ) as Record<SisterWikiId, WikiConfig>),
} satisfies Record<string, WikiConfig>;

/** A sister wiki's proxy configuration, from its entry in wiki-hosts.ts. */
function sisterWikiConfig(id: SisterWikiId): WikiConfig {
  const host: SisterWikiHost = SISTER_WIKI_HOSTS[id];
  const ownApi = sisterWikiApiUrl(host);
  const reader = (SISTER_READER_IDS as readonly string[]).includes(id);
  return {
    label: host.name,
    siteUrl: host.origin,
    apiUrl: () => ownApi,
    // A wiki WikiOS reads resolves files through its configured api.php (iiwiki's development proxy gets past
    // the Cloudflare 403 on imageinfo lookups).
    imageInfoApiUrl: () => (reader ? getMediaWikiApiUrl(id as SisterReaderId) : ownApi),
    corsOrigins: host.proxy.anyCorsOrigin
      ? ["*"]
      : [host.origin, ...host.proxy.extraCorsOrigins, ...DEV_ORIGINS],
    allowedActions: READ_ACTIONS,
    resolveRetries: host.proxy.resolveRetries,
    ...(host.proxy.directImagePrefix && { directImagePrefix: host.proxy.directImagePrefix }),
  };
}

export function getWiki(key: string): WikiConfig | null {
  return Object.hasOwn(WIKIS, key) ? (WIKIS as Record<string, WikiConfig>)[key]! : null;
}

/** Query parameters the api.php proxy forwards (everything else is dropped). */
export const ALLOWED_API_PARAMS = [
  "action",
  "format",
  "formatversion",
  "prop",
  "titles",
  "search",
  "srsearch",
  "srprop",
  "srlimit",
  "srnamespace",
  "srwhat",
  "limit",
  "exintro",
  "explaintext",
  "piprop",
  "rvprop",
  "rvslots",
  "rvsection",
  "iiprop",
  "iilimit",
  "iiurlwidth",
  "origin",
  "list",
  "generator",
  "gcmtitle",
  "gcmlimit",
  "cmtitle",
  "cmlimit",
  "cmprop",
  "cmnamespace",
  "cmtype",
  "cmcontinue",
  "aiprefix",
  "aiprop",
  "ailimit",
  "aisort",
  "aicontinue",
  "redirects",
  "gsrsearch",
  "gsrnamespace",
  "gsrlimit",
  "gsroffset",
  "gcmtype",
  "gcmcontinue",
  "gailimit",
  "gaicontinue",
  "gaifrom",
  "sroffset",
  "iicontinue",
  "continue",
  // `action=parse` of a sister page's revision (sister-render-service.ts) and a page's image list.
  "oldid",
  "page",
  "disableeditsection",
  "disablelimitreport",
  "imlimit",
  // The categories backfill's category and template pages (category-backfill.ts), and their continuation.
  "cllimit",
  "clshow",
  "clcontinue",
  "tllimit",
  "tlnamespace",
  "tlcontinue",
] as const;

export const MEDIA_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
} as const;

function allowedOrigin(wiki: WikiConfig, origin: string | null): string {
  if (wiki.corsOrigins.includes("*")) return "*";
  return origin !== null && wiki.corsOrigins.includes(origin) ? origin : wiki.siteUrl;
}

/**
 * The api.php proxy's CORS headers. A wiki open to every origin says `*`; otherwise a listed `origin` is echoed back and
 * any other caller is told the wiki's own origin, so an origin the wiki does not list is never reflected. The answer
 * depends on `Origin`, so it carries `Vary: Origin`: a shared cache never hands one origin's header to another.
 */
export function apiCorsHeaders(wiki: WikiConfig, origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(wiki, origin),
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
