/**
 * Per-wiki configuration for the MediaWiki proxy routes.
 *
 * `[wiki]/api.php` proxies read-only API calls for every wiki here.
 * `[wiki]/[...path]` proxies media for the external wikis; the local ixwiki media
 * route (`ixwiki/[...path]`) keeps its own handler because it also registers assets
 * and caches buffers. Static segments win over `[wiki]` in Next.js routing.
 */
import { getFullIiwikiApiUrl } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";

export const WIKI_USER_AGENT = "IxStats-Builder";

export interface WikiConfig {
  /** Log prefix. */
  label: string;
  /** Base URL for direct sub-path fetches (media, Special:* pages). */
  siteUrl: string;
  /** api.php URL used by the `api.php` proxy. */
  apiUrl: () => string;
  /** api.php URL used to resolve `Special:FilePath` via `imageinfo` (may differ, e.g. iiwiki dev proxy). */
  imageInfoApiUrl: () => string;
  /** Origins allowed to call the api.php proxy cross-origin. */
  corsOrigins: readonly string[];
  /** Read-only MediaWiki actions the api.php proxy will forward. */
  allowedActions: readonly string[];
  /** Detect a Cloudflare challenge page and answer 503 instead of passing HTML through. */
  detectCloudflare: boolean;
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
    siteUrl: DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, ""),
    // Same-server optimisation when IXWIKI_LOCAL_PATH is set.
    apiUrl: () =>
      `${(process.env.IXWIKI_LOCAL_PATH || DEFAULT_MEDIAWIKI_URL).replace(/\/+$/, "")}/api.php`,
    imageInfoApiUrl: () => `${DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`,
    corsOrigins: ["https://ixwiki.com", "https://www.ixwiki.com", ...DEV_ORIGINS],
    allowedActions: ["query", "opensearch"],
    detectCloudflare: false,
    resolveRetries: 0,
  },
  iiwiki: {
    label: "IIWiki",
    siteUrl: "https://iiwiki.com",
    apiUrl: () => "https://iiwiki.com/api.php",
    // Dev proxy URL bypasses the Cloudflare 403 on imageinfo lookups.
    imageInfoApiUrl: () => getFullIiwikiApiUrl(),
    corsOrigins: ["https://iiwiki.com", "https://www.iiwiki.com", ...DEV_ORIGINS],
    allowedActions: READ_ACTIONS,
    detectCloudflare: true,
    resolveRetries: 0,
    directImagePrefix: "images/",
  },
  althistory: {
    label: "AltHistory",
    siteUrl: "https://althistory.fandom.com",
    apiUrl: () => "https://althistory.fandom.com/api.php",
    imageInfoApiUrl: () => "https://althistory.fandom.com/api.php",
    corsOrigins: ["*"],
    allowedActions: READ_ACTIONS,
    detectCloudflare: false,
    resolveRetries: 2,
  },
  commons: {
    label: "Commons",
    siteUrl: "https://commons.wikimedia.org",
    apiUrl: () => "https://commons.wikimedia.org/w/api.php",
    imageInfoApiUrl: () => "https://commons.wikimedia.org/w/api.php",
    corsOrigins: ["https://commons.wikimedia.org", "https://upload.wikimedia.org", ...DEV_ORIGINS],
    allowedActions: READ_ACTIONS,
    detectCloudflare: false,
    resolveRetries: 0,
  },
} as const satisfies Record<string, WikiConfig>;

export type WikiKey = keyof typeof WIKIS;

export function getWiki(key: string): WikiConfig | null {
  return Object.prototype.hasOwnProperty.call(WIKIS, key) ? WIKIS[key as WikiKey] : null;
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
] as const;

export const MEDIA_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
} as const;

export function apiCorsHeaders(
  wiki: WikiConfig,
  origin: string | null
): Record<string, string> {
  const allowed =
    wiki.corsOrigins.includes("*") || (origin && wiki.corsOrigins.includes(origin))
      ? (origin ?? "*")
      : (wiki.corsOrigins[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
