/**
 * Client entrypoint for IxCards UI rendering, display utilities, and themes
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
  type LoreCategory as LoreCategoryType,
} from "./category-enums";

export {
  CATEGORY_THEMES,
  getCategoryTheme,
  getCategoryLabel,
  getCategoryAccentColor,
  type CategoryTheme,
} from "./category-theme";

export {
  classifyLoreArticle,
  classifyFromWikitext,
  extractInfoboxTemplatesFromWikitext,
  INFOBOX_CATEGORY_MAP,
  type ArticleClassificationInput,
} from "./category-classifier";

export * from "./subcategory-registry";
export * from "./rarity-algorithm";
export * from "./rarity-materials";
export * from "./card-metadata-resolver";
export * from "./enums";
export {
  type CardImageType,
  type CardImagePreset,
  cardImagePresets,
  getCardImagePreset,
  getUnsplashSearchUrl,
  getFallbackGradient,
  allowsCustomUpload,
  getCustomUploadableTypes,
  isValidCardImageType,
} from "./image-presets";
export * from "./stat-config";
export * from "./pack-opening-service";
export * from "./ns-image-proxy";
export * from "./display-utils";

// Pure calculation exports from valuation
export {
  computeCardValue,
  getValuationConfig,
  type CardValuationConfig,
} from "./valuation";
