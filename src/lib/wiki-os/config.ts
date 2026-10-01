// src/lib/wiki-os/config.ts
// Single source of truth for WikiOS and MediaWiki configuration.

export const DEFAULT_USER_AGENT = "IxStats-Builder";
export const DEFAULT_MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
export const MEDIAWIKI_TARGET_VERSION = "1.45.1";

export type WikiSource = "ixwiki" | "iiwiki" | "althistory";

export interface WikiSourceConfig {
  name: string;
  baseUrl: string;
  apiEndpoint: string;
  description?: string;
  userAgent: string;
}

export const WIKI_SOURCES: Record<WikiSource, WikiSourceConfig> = {
  ixwiki: {
    name: "IxWiki",
    baseUrl: DEFAULT_MEDIAWIKI_URL,
    apiEndpoint: "/api.php",
    description:
      "The bespoke two-decades old geopolitical worldbuilding community & fictional encyclopedia",
    userAgent: DEFAULT_USER_AGENT,
  },
  iiwiki: {
    name: "IIWiki",
    baseUrl: "https://iiwiki.com",
    apiEndpoint: "/api.php",
    description: "SimFic and Alt-History Encyclopedia",
    userAgent: DEFAULT_USER_AGENT,
  },
  althistory: {
    name: "AltHistory Wiki",
    baseUrl: "https://althistory.fandom.com",
    apiEndpoint: "/api.php",
    description: "Alternative History and Speculative Fiction Encyclopedia",
    userAgent: DEFAULT_USER_AGENT,
  },
} as const;

export interface MediaWikiConfig {
  baseUrl: string;
  apiEndpoint: string;
  userAgent: string;
  timeout: number;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  cache: {
    infoboxTtl: number;
    flagTtl: number;
    templateTtl: number;
    pageTtl: number;
    maxSize: number;
  };
  retry: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
  };
}

export const MEDIAWIKI_CONFIG: MediaWikiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com",
  apiEndpoint: "/api.php",
  userAgent: DEFAULT_USER_AGENT,
  timeout: 20000,
  rateLimit: {
    maxRequests: 90,
    windowMs: 60 * 1000,
  },
  cache: {
    infoboxTtl: 24 * 60 * 60 * 1000,
    flagTtl: 30 * 24 * 60 * 60 * 1000,
    templateTtl: 24 * 60 * 60 * 1000,
    pageTtl: 6 * 60 * 60 * 1000,
    maxSize: 1000,
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
  },
};

export function getWikiBaseUrl(source: WikiSource = "ixwiki"): string {
  const wikiConfig = WIKI_SOURCES[source];
  return wikiConfig?.baseUrl ?? "https://ixwiki.com";
}

export function getWikiUserAgent(_source: WikiSource = "ixwiki"): string {
  return DEFAULT_USER_AGENT;
}

function isWikiSource(value: string): value is WikiSource {
  return Object.hasOwn(WIKI_SOURCES, value);
}

/** A `?source=` value as a wiki source; anything else reads as ixwiki. */
export function parseWikiSource(value: string | null | undefined): WikiSource {
  return value && isWikiSource(value) ? value : "ixwiki";
}

/**
 * `wikios.getArticleHtml` input: an IxWiki page by title alone, so the reader, the server render and
 * hover prefetch share one cache key. `followRedirect: false` is `?redirect=no`: the redirect page itself.
 */
export function articleHtmlInput(
  title: string,
  source: WikiSource,
  { followRedirect = true }: { followRedirect?: boolean } = {}
): { title: string; wikiSource?: WikiSource; redirect?: "no" } {
  if (source !== "ixwiki") return { title, wikiSource: source };
  return followRedirect ? { title } : { title, redirect: "no" };
}

/** The WikiOS reader path for a page; a page of another wiki carries `?source=`. */
export function wikiReaderPath(title: string, source: WikiSource = "ixwiki"): string {
  const path = `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  return source === "ixwiki" ? path : `${path}?source=${source}`;
}

/**
 * Get the appropriate MediaWiki API URL based on context and wiki source
 */
export function getMediaWikiApiUrl(source: WikiSource = "ixwiki"): string {
  if (source === "ixwiki" && process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL) {
    return process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
  }
  if (source === "iiwiki") {
    if (process.env.IIWIKI_DEV_PROXY_URL) {
      return process.env.IIWIKI_DEV_PROXY_URL;
    }
    if (process.env.NODE_ENV === "development") {
      return "https://maps.ixwiki.com/api/mediawiki/iiwiki/api.php";
    }
  }
  const wikiConfig = WIKI_SOURCES[source] ?? WIKI_SOURCES.ixwiki;
  return `${wikiConfig.baseUrl}${wikiConfig.apiEndpoint}`;
}

/**
 * Builds a full MediaWiki API URL with query parameters.
 */
export function buildApiUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean>
): string {
  const cleanBase = baseUrl.endsWith("/api.php")
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, "")}/api.php`;
  const url = new URL(cleanBase);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Uploads (plan 411)
// ---------------------------------------------------------------------------

/**
 * The largest upload WikiOS takes, in bytes. A decimal 10 MB, not 10 MiB: the request body (the file itself, see
 * app/api/wiki/upload) must stay under Next's `experimental.proxyClientMaxBodySize` (10 MiB by default), which clones
 * a proxied body and silently truncates it past that size. Raise the two together (docs/operations/wikios-v1-cutover.md).
 */
export const MAX_UPLOAD_BYTES = 10_000_000;

/** The file types an upload may be, by extension. The bytes are what decide: see core/file-sniff.ts. */
export const UPLOAD_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf"] as const;

/**
 * The most pixels (width times height) a raster upload may have: MediaWiki's `$wgMaxImageArea` default, 12.5 megapixels,
 * above which it cannot make a thumbnail of the file. WikiOS refuses such an upload as MediaWiki's own would end up useless.
 * A wiki that raised `$wgMaxImageArea` sets WIKIOS_MAX_IMAGE_AREA to the same number. An SVG is a drawing and is not held to it
 * (it is held to the byte limit like every file). Server only.
 */
export const DEFAULT_MAX_IMAGE_AREA = 12_500_000;

export function getMaxImageArea(): number {
  const configured = Number(process.env.WIKIOS_MAX_IMAGE_AREA);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_IMAGE_AREA;
}

/** Where WikiOS keeps an upload until MediaWiki holds it too: WIKIOS_UPLOAD_DIR, else `.wikios-uploads` under the app. Server only. */
export function getUploadDir(): string {
  return process.env.WIKIOS_UPLOAD_DIR || `${process.cwd()}/.wikios-uploads`;
}

/** The path WikiOS serves an upload from while it alone holds the bytes (`wiki_assets.url`); the file's name follows. */
export const STAGED_FILE_PATH = "/api/wiki/file/";

export { type CachedArticleData } from "./types";
