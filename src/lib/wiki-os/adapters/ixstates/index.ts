/**
 * index.ts — IxStates Simulation & Game Adapters Barrel Export
 *
 * Provides national factbook extraction, IxVault collectible card generation,
 * interactive 3D map pinning, and eligible simulation country discovery.
 */

export * from "./unified-parser";
export * from "./infobox-mapper";
export * from "./lore-card-generator";
export * from "./ixworld-mapper";
export * from "./eligible-country-service";
export {
  type WikiSection,
  type WikiTable,
  type WikiList,
  type WikiExtractedContent,
  extractWikiContent,
} from "./content-extractor";
export * from "./content-analyzer";
export * from "./entity-parser";
export * from "./user-sync";
export * from "./integration";
export {
  cleanWikitextForDisplay,
  type WikiProfileSection,
  type WikiCountryProfile,
  WikiCacheService,
  wikiCacheService,
} from "./cache-service";
