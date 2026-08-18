/**
 * src/lib/wiki/index.ts — Master barrel export for IxStats Wiki domain.
 *
 * Provides a unified entry point for all wiki parsers, bridges, and utilities.
 */

// Core types & configuration
export * from "./config";

// Image URL utilities
export * from "./image-url";

// Tokenizer and infobox parsing
export * from "./infobox-parser";

// Wikitext parser and plain text stripping
export * from "./wikitext-parser";

// Unified high-level infobox parser (80+ fields)
export {
  parseInfoboxWithTemplates,
  fetchAndParseInfobox,
  type UnifiedInfoboxData,
} from "./unified-parser";

// Unified Wiki Bridge (Direct MySQL / API)
export {
  // DB & Query functions
  getIxWikiPool,
  getWikiDbPool,
  closeWikiBridge,
  getArticleWikitext,
  getArticleIntro,
  searchPages,
  getInfobox,
  getPageSections,
  getRecentChanges,
  getPageHistory,
  getUserContribs,
  getUserInfo,
  getBacklinks,
  getCategoryMembers,
  getSiteStats,
  getRandomPage,
  resolveRedirect,
  getRevisionWikitext,
  getCurrentRevMeta,
  getNamespacedWikitext,
  searchTemplates,
  fullTextSearch,
  getParentCategories,
  getCategoryInfo,
  getPageProps,
  getPageProtection,
  getImageMeta,
  getPageLog,
  getCoordinates,
  getPageImages,
  searchWithFallback,
  ixwikiGetCategoryTree,
  // Types
  type WikiSearchResult,
  type WikiArticle,
  type WikiRecentChange,
} from "./bridge";

// Multi-wiki search client
export * from "./search-service";

// Entity & infobox mappers
export * from "./infobox-mapper";
export * from "./entity-parser";

// Content extraction & semantic analyzer
export {
  extractWikiContent,
  type WikiExtractedContent,
  type WikiSection as ExtractedWikiSection,
  type WikiTable,
  type WikiList,
} from "./content-extractor";
export * from "./content-analyzer";

// Integrations & generators
export * from "./ixworld-mapper";
export * from "./integration";
export * from "./local-cache";
export * from "./prose-generator";
export * from "./user-sync";
export * from "./lore-card-generator";
export * from "./legacy-service";
export * from "./cache-service";
export * from "./data-parser";
export * from "./factbook-routes";
export * from "./eligible-country-service";
