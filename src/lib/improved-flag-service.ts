// Improved Flag Service - Uses ONLY Wiki Commons API (NO local files)
// This replaces the existing flag-service.ts

import { wikiCommonsFlagService } from './wiki-commons-flag-service';
import { ixnayWiki } from './mediawiki-service';

export interface FlagServiceStats {
  totalCountries: number;
  cachedFlags: number;
  localFiles: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  nextUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
}

class ImprovedFlagService {
  /**
   * Initialize the flag service with a list of countries
   */
  async initialize(countryNames: string[]): Promise<void> {
    console.log(`[ImprovedFlagService] Initializing with ${countryNames.length} countries (Wiki Commons API only)`);
    // Just preload flags from Wiki Commons API - no local storage
    await wikiCommonsFlagService.batchGetFlags(countryNames);
  }

  /**
   * Get flag URL for a country using ONLY Wiki Commons API
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    try {
      console.log(`[ImprovedFlagService] Getting flag URL for ${countryName} (Wiki Commons API only)`);
      return await wikiCommonsFlagService.getFlagUrl(countryName);
    } catch (error) {
      console.error(`[ImprovedFlagService] Error getting flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get cached flag URL (synchronous, no network requests)
   * Uses ONLY Wiki Commons API cache, NO local files
   */
  getCachedFlagUrl(countryName: string): string | null {
    return wikiCommonsFlagService.getCachedFlagUrl(countryName);
  }

  /**
   * Check if a flag URL is a placeholder
   */
  isPlaceholderFlag(url: string): boolean {
    return wikiCommonsFlagService.isPlaceholderFlag(url);
  }

  /**
   * Batch get flag URLs for multiple countries using ONLY Wiki Commons API
   */
  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    return await wikiCommonsFlagService.batchGetFlags(countryNames);
  }

  /**
   * Preload flags for multiple countries using ONLY Wiki Commons API
   */
  async preloadFlags(countryNames: string[]): Promise<void> {
    console.log(`[ImprovedFlagService] Preloading ${countryNames.length} flags (Wiki Commons API only)`);
    await wikiCommonsFlagService.batchGetFlags(countryNames);
  }

  /**
   * Get comprehensive service statistics
   */
  getStats(): FlagServiceStats {
    const wikiStats = wikiCommonsFlagService.getStats();
    
    return {
      totalCountries: wikiStats.totalRequested,
      cachedFlags: wikiStats.cachedFlags,
      localFiles: 0, // No local files anymore
      failedFlags: wikiStats.failedFlags,
      lastUpdateTime: null,
      nextUpdateTime: null,
      isUpdating: false,
      updateProgress: {
        current: 0,
        total: 0,
        percentage: 0
      },
    };
  }

  /**
   * Force update all flags (clear cache and re-fetch from Wiki Commons)
   */
  async updateAllFlags(): Promise<void> {
    console.log(`[ImprovedFlagService] Starting manual flag update (Wiki Commons API only)`);
    wikiCommonsFlagService.clearCache();
  }

  /**
   * Clear all flag caches (Wiki Commons API cache only)
   */
  async clearCache(): Promise<void> {
    console.log(`[ImprovedFlagService] Clearing all caches (Wiki Commons API only)`);
    wikiCommonsFlagService.clearCache();
  }

  /**
   * Clear cache for a specific country
   */
  async clearCountryCache(countryName: string): Promise<void> {
    console.log(`[ImprovedFlagService] Clearing cache for ${countryName}`);
    wikiCommonsFlagService.clearCountryCache(countryName);
  }

  /**
   * Get local flag URL only (always returns null - no local files)
   */
  getLocalFlagUrl(countryName: string): string | null {
    console.log(`[ImprovedFlagService] getLocalFlagUrl called for ${countryName} - NO LOCAL FILES, returning null`);
    return null; // NO LOCAL FILES EVER
  }

  /**
   * Check if flag is available locally (always returns false - no local files)
   */
  hasLocalFlag(countryName: string): boolean {
    console.log(`[ImprovedFlagService] hasLocalFlag called for ${countryName} - NO LOCAL FILES, returning false`);
    return false; // NO LOCAL FILES EVER
  }
}

// Export singleton instance
export const improvedFlagService = new ImprovedFlagService();
export default improvedFlagService;