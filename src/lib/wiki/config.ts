// src/lib/wiki/config.ts
// Re-export canonical WikiOS configuration for backward compatibility.

export * from "~/lib/wiki-os/config";
export {
  buildApiUrl,
  MEDIAWIKI_CONFIG,
  DEFAULT_USER_AGENT,
  WIKI_SOURCES,
  getMediaWikiApiUrl,
  getWikiBaseUrl,
  getWikiUserAgent,
  type WikiSource,
  type WikiSourceConfig,
  type MediaWikiConfig,
  type CachedArticleData,
} from "~/lib/wiki-os/config";
