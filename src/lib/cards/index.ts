/**
 * src/lib/cards/index.ts — Master barrel export for IxCards domain.
 *
 * Provides a unified entry point for all card types, algorithms, services, and display utilities.
 */

// Category enums & classifiers
export {
  LoreCategory,
  ArtworkSource,
  BROWSABLE_CATEGORIES,
  CATEGORY_SYNONYMS,
  getCategorySynonyms,
  findMatchingCategory,
  isValidLoreCategory,
  isValidArtworkSource,
} from "./category-enums";
export type { LoreCategory as LoreCategoryType } from "./category-enums";

export {
  CATEGORY_THEMES,
  getCategoryTheme,
  getCategoryLabel,
  getCategoryAccentColor,
} from "./category-theme";
export type { CategoryTheme } from "./category-theme";

export {
  classifyLoreArticle,
  classifyFromWikitext,
  extractInfoboxTemplatesFromWikitext,
  INFOBOX_CATEGORY_MAP,
} from "./category-classifier";
export type { ArticleClassificationInput } from "./category-classifier";

export * from "./subcategory-registry";
export * from "./rarity-algorithm";
export * from "./rarity-materials";
export * from "./card-metadata-resolver";

// Consolidated core card subsystems
export * from "./enums";
export * from "./general-settings";
export * from "./image-presets";
export * from "./pack-service";
export * from "./card-service";
export * from "./stat-config";
export * from "./valuation";
export * from "./xp-utils";
export * from "./season";
export * from "./pack-opening-service";
export * from "./ns-image-proxy";
export * from "./display-utils";
