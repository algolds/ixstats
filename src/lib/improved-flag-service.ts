// Improved Flag Service - Uses enhanced cache manager with local file storage
// This replaces the existing flag-service.ts

import { enhancedFlagCacheManager } from './enhanced-flag-cache-manager';
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
    console.log(`[ImprovedFlagService] Initializing with ${countryNames.length} countries`);
    await enhancedFlagCacheManager.initialize(countryNames);
  }

  /**
   * Get flag URL for a country - local file first, then cached URL, then fetch
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    try {
      console.log(`[ImprovedFlagService] Getting flag URL for ${countryName}`);

      // Priority 1: Check if we have a local file
      const localUrl = enhancedFlagCacheManager.getLocalFlagUrl(countryName);
      if (localUrl) {
        console.log(`[ImprovedFlagService] Using local file for ${countryName}: ${localUrl}`);
        return localUrl;
      }

      // Priority 2: Check MediaWiki cache (fast)
      const cachedUrl = ixnayWiki.getCachedFlagUrl(countryName);
      if (cachedUrl && !cachedUrl.includes('placeholder')) {
        console.log(`[ImprovedFlagService] Using cached URL for ${countryName}: ${cachedUrl}`);
        return cachedUrl;
      }

      // Priority 3: Fetch and cache from enhanced cache manager (which will download locally)
      console.log(`[ImprovedFlagService] Fetching and caching flag for ${countryName}`);
      const fetchedUrl = await enhancedFlagCacheManager.fetchAndCacheFlag(countryName);
      if (fetchedUrl) {
        console.log(`[ImprovedFlagService] Successfully fetched and cached flag for ${countryName}: ${fetchedUrl}`);
        return fetchedUrl;
      }

      // Priority 4: Fallback to placeholder
      console.log(`[ImprovedFlagService] Using placeholder for ${countryName}`);
      return '/placeholder-flag.svg';
    } catch (error) {
      console.error(`[ImprovedFlagService] Error getting flag for ${countryName}:`, error);
      return '/placeholder-flag.svg';
    }
  }

  /**
   * Get cached flag URL (synchronous, no network requests)
   * Checks local files first, then memory cache
   */
  getCachedFlagUrl(countryName: string): string | null {
    // First check if we have a local file
    const localUrl = enhancedFlagCacheManager.getLocalFlagUrl(countryName);
    if (localUrl) {
      return localUrl;
    }

    // Then check MediaWiki service cache
    const cachedUrl = ixnayWiki.getCachedFlagUrl(countryName);
    if (cachedUrl && !cachedUrl.includes('placeholder')) {
      return cachedUrl;
    }

    return null;
  }

  /**
   * Check if a flag URL is a placeholder
   */
  isPlaceholderFlag(url: string): boolean {
    return url.includes('placeholder') || url.includes('default') || url.endsWith('placeholder-flag.svg');
  }

  /**
   * Batch get flag URLs for multiple countries
   */
  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    // Process in smaller batches to avoid overwhelming the system
    const BATCH_SIZE = 5;
    for (let i = 0; i < countryNames.length; i += BATCH_SIZE) {
      const batch = countryNames.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (countryName) => {
        try {
          const url = await this.getFlagUrl(countryName);
          results[countryName] = url;
        } catch (error) {
          console.error(`[ImprovedFlagService] Batch error for ${countryName}:`, error);
          results[countryName] = '/placeholder-flag.svg';
        }
      });

      await Promise.allSettled(batchPromises);
      
      // Small delay between batches
      if (i + BATCH_SIZE < countryNames.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Preload flags for multiple countries (prioritizes local caching)
   */
  async preloadFlags(countryNames: string[]): Promise<void> {
    console.log(`[ImprovedFlagService] Preloading ${countryNames.length} flags`);
    
    // Use the enhanced cache manager to handle preloading
    await enhancedFlagCacheManager.initialize(countryNames);
  }

  /**
   * Get comprehensive service statistics
   */
  getStats(): FlagServiceStats {
    const cacheStats = enhancedFlagCacheManager.getStats();
    
    return {
      totalCountries: cacheStats.totalCountries,
      cachedFlags: cacheStats.cachedFlags,
      localFiles: cacheStats.localFiles,
      failedFlags: cacheStats.failedFlags,
      lastUpdateTime: cacheStats.lastUpdateTime,
      nextUpdateTime: cacheStats.nextUpdateTime,
      isUpdating: cacheStats.isUpdating,
      updateProgress: cacheStats.updateProgress,
    };
  }

  /**
   * Force update all flags (re-download and cache locally)
   */
  async updateAllFlags(): Promise<void> {
    console.log(`[ImprovedFlagService] Starting manual flag update`);
    await enhancedFlagCacheManager.updateAllFlags();
  }

  /**
   * Clear all flag caches (both memory and local files)
   */
  async clearCache(): Promise<void> {
    console.log(`[ImprovedFlagService] Clearing all caches`);
    ixnayWiki.clearCache();
    await enhancedFlagCacheManager.clearLocalCache();
  }

  /**
   * Clear cache for a specific country
   */
  async clearCountryCache(countryName: string): Promise<void> {
    console.log(`[ImprovedFlagService] Clearing cache for ${countryName}`);
    ixnayWiki.clearCountryCache(countryName);
    // Note: Enhanced cache manager doesn't have per-country clearing yet,
    // but could be added if needed
  }

  /**
   * Get local flag URL only (returns null if not cached locally)
   */
  getLocalFlagUrl(countryName: string): string | null {
    return enhancedFlagCacheManager.getLocalFlagUrl(countryName);
  }

  /**
   * Check if flag is available locally
   */
  hasLocalFlag(countryName: string): boolean {
    return enhancedFlagCacheManager.getLocalFlagUrl(countryName) !== null;
  }
}

// Export singleton instance
export const improvedFlagService = new ImprovedFlagService();
export default improvedFlagService;