// src/lib/wiki-os/config.ts
// Single source of truth for WikiOS and MediaWiki configuration.

export const DEFAULT_USER_AGENT = "IxStats-Builder";
export const DEFAULT_MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";

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
export function buildApiUrl(baseUrl: string, params: Record<string, string | number | boolean>): string {
  const cleanBase = baseUrl.endsWith("/api.php") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/api.php`;
  const url = new URL(cleanBase);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export { type CachedArticleData } from "./types";
