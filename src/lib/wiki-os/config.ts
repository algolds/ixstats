// src/lib/wiki-os/config.ts
// Single source of truth for WikiOS and MediaWiki configuration (plan 415, v1 decision D14):
// the wiki's name, its public host and its MediaWiki endpoints are read from the environment once,
// here. No other file spells the host or re-derives it from `process.env`.

export const DEFAULT_USER_AGENT = "IxStats-Builder";
export const MEDIAWIKI_TARGET_VERSION = "1.45.1";

/** The public host when `NEXT_PUBLIC_MEDIAWIKI_URL` is unset: the only place the host is spelled. */
const FALLBACK_PUBLIC_BASE_URL = "https://ixwiki.com";

export type WikiSource = "ixwiki" | "iiwiki" | "althistory";

export interface WikiSourceConfig {
  name: string;
  baseUrl: string;
  apiEndpoint: string;
  description?: string;
  userAgent: string;
}

/** What `buildWikiosConfig` reads; each field is one environment variable, `undefined` when unset. */
export interface WikiosConfigInput {
  /** `NEXT_PUBLIC_MEDIAWIKI_URL`: the public origin of the wiki. */
  publicUrl?: string | undefined;
  /** `WIKIOS_MEDIAWIKI_INTERNAL_URL`: the loopback `api.php` the private render engine answers on. */
  internalApiUrl?: string | undefined;
  /** `WIKIOS_MEDIAWIKI_API`: the `api.php` the mirror writes through. */
  writeApiUrl?: string | undefined;
  /** `WIKIOS_MEDIAWIKI_BOT_USER`: the mirror's bot login (`Name@BotName`). */
  botUser?: string | undefined;
}

export interface WikiosConfig {
  readonly siteName: string;
  /** The name of namespace 4: "IxWiki" in `IxWiki:Getting started`. */
  readonly projectNamespace: string;
  /** The public origin with no trailing slash: `https://ixwiki.com`. */
  readonly publicBaseUrl: string;
  /** Its host (with the port, if any): what a link to the wiki is recognised by. */
  readonly publicHost: string;
  /** Where articles live under the origin: `/wiki/`. */
  readonly articlePath: string;
  /** Sent to every wiki WikiOS reads; the sister wikis allow-list it. */
  readonly userAgent: string;
  readonly mediawiki: {
    /** The public `api.php`: what a browser or an outside tool would call. */
    readonly publicApiUrl: string;
    /** The `api.php` every server-side call uses: the loopback engine when configured, else the public one. */
    readonly internalApiUrl: string;
    /** The `api.php` the mirror writes through. */
    readonly writeApiUrl: string;
    /** The mirror's bot login; `undefined` when none is configured (the mirror then stays off). */
    readonly botUser: string | undefined;
  };
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    throw new Error(`NEXT_PUBLIC_MEDIAWIKI_URL is not a URL: "${origin}"`);
  }
}

/** The configuration for `input`; a pure function, so a test can build one for any environment. */
export function buildWikiosConfig(input: WikiosConfigInput): WikiosConfig {
  const publicBaseUrl = trimTrailingSlashes(
    blankToUndefined(input.publicUrl) ?? FALLBACK_PUBLIC_BASE_URL
  );
  const publicApiUrl = `${publicBaseUrl}/api.php`;
  const internalApiUrl = blankToUndefined(input.internalApiUrl) ?? publicApiUrl;
  return Object.freeze({
    siteName: "IxWiki",
    projectNamespace: "IxWiki",
    publicBaseUrl,
    publicHost: hostOf(publicBaseUrl),
    articlePath: "/wiki/",
    userAgent: DEFAULT_USER_AGENT,
    mediawiki: Object.freeze({
      publicApiUrl,
      internalApiUrl,
      writeApiUrl: blankToUndefined(input.writeApiUrl) ?? internalApiUrl,
      botUser: blankToUndefined(input.botUser),
    }),
  });
}

// Each variable is named in full: a browser bundle only replaces the `process.env.NEXT_PUBLIC_*` it can see.
export const wikiosConfig: WikiosConfig = buildWikiosConfig({
  publicUrl: process.env.NEXT_PUBLIC_MEDIAWIKI_URL,
  internalApiUrl: process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL,
  writeApiUrl: process.env.WIKIOS_MEDIAWIKI_API,
  botUser: process.env.WIKIOS_MEDIAWIKI_BOT_USER,
});

/** The public origin, with no trailing slash: where a browser reaches the wiki. */
export function mediaWikiOrigin(): string {
  return wikiosConfig.publicBaseUrl;
}

/**
 * The wiki's `api.php`. A server-side call asks for the `internal` one (the loopback engine when
 * configured); the `public` one is for a URL a browser or an outside tool follows.
 */
export function mediaWikiApiUrl({ internal }: { internal: boolean }): string {
  return internal ? wikiosConfig.mediawiki.internalApiUrl : wikiosConfig.mediawiki.publicApiUrl;
}

/** `/wiki/` path segment for a title: underscores, percent-encoded, ":" and "/" kept literal. */
export function titleUrlPath(title: string): string {
  return encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/");
}

/** The public URL of a page of the wiki (default IxWiki, else the sister wiki `source`). */
export function publicArticleUrl(title: string, source: WikiSource = "ixwiki"): string {
  return `${getWikiBaseUrl(source)}${wikiosConfig.articlePath}${titleUrlPath(title)}`;
}

/** The public URL of a file the wiki's host serves: `path` is `/images/8/88/Flag.svg` or `images/8/88/Flag.svg`. */
export function mediaWikiImageUrl(path: string): string {
  return `${wikiosConfig.publicBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Whether `url` is on the wiki's own host (or its `www.` alias): an absolute or protocol-relative URL. */
export function isMediaWikiUrl(url: string): boolean {
  try {
    const host = new URL(url, "https://relative.invalid").host;
    return host === wikiosConfig.publicHost || host === `www.${wikiosConfig.publicHost}`;
  } catch {
    return false;
  }
}

/** A regular-expression source matching the wiki's host or its `www.` alias, for detecting a link to it. */
export function mediaWikiHostPattern(): string {
  return `(?:www\\.)?${wikiosConfig.publicHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

/** The title of the page a link on the wiki's own host points at (`https://<host>/wiki/Title`), or null. */
export function wikiTitleFromArticleUrl(url: string | null | undefined): string | null {
  const segment = url
    ? new RegExp(`${mediaWikiHostPattern()}\\/wiki\\/([^#?]+)`).exec(url)?.[1]
    : undefined;
  if (!segment) return null;
  try {
    return decodeURIComponent(segment).replace(/_/g, " ");
  } catch {
    return segment.replace(/_/g, " ");
  }
}

export const WIKI_SOURCES: Record<WikiSource, WikiSourceConfig> = {
  ixwiki: {
    name: wikiosConfig.siteName,
    baseUrl: wikiosConfig.publicBaseUrl,
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

export function getWikiBaseUrl(source: WikiSource = "ixwiki"): string {
  return WIKI_SOURCES[source]?.baseUrl ?? wikiosConfig.publicBaseUrl;
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
 * A sister wiki's own `api.php`, whatever the environment: no dev proxy (`IIWIKI_DEV_PROXY_URL`, or the maps host's
 * relay in development), which only forwards GET. For a request that must be a POST (`action=parse&text=`).
 */
export function sisterApiUrl(source: Exclude<WikiSource, "ixwiki">): string {
  const wiki = WIKI_SOURCES[source];
  return `${wiki.baseUrl}${wiki.apiEndpoint}`;
}

/**
 * Get the appropriate MediaWiki API URL based on context and wiki source. IxWiki's is the internal
 * one (the private render engine when configured): this is for server-side calls.
 */
export function getMediaWikiApiUrl(source: WikiSource = "ixwiki"): string {
  if (source === "ixwiki") return mediaWikiApiUrl({ internal: true });
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
