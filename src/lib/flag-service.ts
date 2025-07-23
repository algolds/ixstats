// src/lib/flag-service.ts
// Flag service - now uses unified media service internally

import { unifiedMediaService } from './unified-media-service';
import { ixnayWiki } from './mediawiki-service';

export interface FlagServiceStats {
  totalCountries: number;
  cachedFlags: number;
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

class FlagService {
  /**
   * Initialize the flag service with a list of countries
   */
  async initialize(countryNames: string[]): Promise<void> {
    console.log(`[FlagService] Initializing with ${countryNames.length} countries`);
    await unifiedMediaService.preloadFlags(countryNames);
  }

  /**
   * Get flag URL for a country - cache-first approach
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    try {
      // First check MediaWiki cache (most comprehensive)
      const cachedFlag = ixnayWiki.getCachedFlagUrl(countryName);
      if (cachedFlag && !cachedFlag.includes('placeholder')) {
        console.log(`[FlagService] Cache hit for ${countryName}: ${cachedFlag}`);
        return cachedFlag;
      }

      // If no cache hit, fetch from MediaWiki API
      console.log(`[FlagService] Cache miss for ${countryName}, fetching from API`);
      const apiResult = await ixnayWiki.getFlagUrl(countryName);
      console.log(`[FlagService] API result for ${countryName}:`, apiResult);
      if (typeof apiResult === 'string' && !apiResult.includes('placeholder')) {
        console.log(`[FlagService] Using MediaWiki API URL for ${countryName}: ${apiResult}`);
        return apiResult;
      }

      // Fallback to unified media service
      const fallbackResult = await unifiedMediaService.getFlagUrl(countryName);
      return fallbackResult;
    } catch (error) {
      console.error(`[FlagService] Error getting flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get cached flag URL (synchronous, no network requests) - check all caches
   */
  getCachedFlagUrl(countryName: string): string | null {
    // First check MediaWiki service cache (primary)
    const mediaWikiCached = ixnayWiki.getCachedFlagUrl(countryName);
    if (mediaWikiCached && !mediaWikiCached.includes('placeholder')) {
      return mediaWikiCached;
    }

    // Then check unified media service cache
    const unifiedCached = unifiedMediaService.getCachedFlagUrl(countryName);
    if (unifiedCached && !unifiedCached.includes('placeholder')) {
      return unifiedCached;
    }

    return null;
  }

  /**
   * Check if a flag URL is a placeholder
   */
  isPlaceholderFlag(url: string): boolean {
    return unifiedMediaService.isPlaceholderFlag(url);
  }

  /**
   * Batch get flag URLs for multiple countries
   */
  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    return unifiedMediaService.batchGetFlags(countryNames);
  }

  /**
   * Get comprehensive service statistics
   */
  getStats(): FlagServiceStats {
    const mediaWikiStats = ixnayWiki.getCacheStats();
    const unifiedStats = unifiedMediaService.getCacheStats();
    
    return {
      totalCountries: mediaWikiStats.flags + unifiedStats.cacheSize,
      cachedFlags: mediaWikiStats.flags,
      failedFlags: mediaWikiStats.failedFlags || 0,
      lastUpdateTime: Date.now(),
      nextUpdateTime: null,
      isUpdating: false,
      updateProgress: {
        current: mediaWikiStats.flags,
        total: mediaWikiStats.flags + (mediaWikiStats.failedFlags || 0),
        percentage: mediaWikiStats.flags > 0 ? Math.round((mediaWikiStats.flags / (mediaWikiStats.flags + (mediaWikiStats.failedFlags || 0))) * 100) : 0,
      },
    };
  }

  /**
   * Clear all flag caches
   */
  clearCache(): void {
    ixnayWiki.clearCache();
    unifiedMediaService.clearCache('flags');
    console.log('[FlagService] Cleared all flag caches');
  }
}

// Export singleton instance
export const flagService = new FlagService();
export default flagService;