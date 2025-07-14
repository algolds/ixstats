// src/lib/flag-service.ts
// Simple flag service for ixstats to get country flag URLs

import { flagCacheManager } from './flag-cache-manager';
import { IxnayWikiService } from './mediawiki-service';

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
  private wikiService: IxnayWikiService;

  constructor() {
    this.wikiService = new IxnayWikiService();
  }

  /**
   * Initialize the flag service with a list of countries
   */
  async initialize(countryNames: string[]): Promise<void> {
    console.log(`[FlagService] Initializing with ${countryNames.length} countries`);
    await flagCacheManager.initialize(countryNames);
  }

  /**
   * Get flag URL for a country
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    try {
      // First try the flag cache manager
      const flagUrl = await flagCacheManager.getFlagUrl(countryName);
      if (flagUrl) {
        return flagUrl;
      }

      // Fallback to direct MediaWiki service
      const fallbackUrl = await this.wikiService.getFlagUrl(countryName);
      if (typeof fallbackUrl === 'string') {
        return fallbackUrl;
      }

      return null;
    } catch (error) {
      console.error(`[FlagService] Error getting flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get cached flag URL (synchronous, no network requests)
   */
  getCachedFlagUrl(countryName: string): string | null {
    // Try flag cache manager first
    const cachedUrl = this.wikiService.getCachedFlagUrl(countryName);
    if (cachedUrl) {
      return cachedUrl;
    }

    return null;
  }

  /**
   * Preload flags for a list of countries
   */
  async preloadFlags(countryNames: string[]): Promise<void> {
    console.log(`[FlagService] Preloading flags for ${countryNames.length} countries`);
    
    // Update the flag cache manager with new countries
    await flagCacheManager.initialize(countryNames);
    
    // Also preload using the MediaWiki service for redundancy
    await this.wikiService.preloadCountryFlags(countryNames);
  }

  /**
   * Get flag service statistics
   */
  getStats(): FlagServiceStats {
    return flagCacheManager.getStats();
  }

  /**
   * Manually trigger a flag cache update
   */
  async updateFlags(): Promise<void> {
    console.log(`[FlagService] Manually triggering flag update`);
    await flagCacheManager.updateAllFlags();
  }

  /**
   * Clear all flag caches
   */
  clearCache(): void {
    console.log(`[FlagService] Clearing all flag caches`);
    this.wikiService.clearCache();
  }

  /**
   * Clear cache for a specific country
   */
  clearCountryCache(countryName: string): void {
    console.log(`[FlagService] Clearing cache for ${countryName}`);
    this.wikiService.clearCountryCache(countryName);
  }

  /**
   * Get the default placeholder flag URL
   */
  getPlaceholderFlagUrl(): string {
    return '/api/placeholder-flag.svg';
  }

  /**
   * Check if a flag URL is a placeholder
   */
  isPlaceholderFlag(url: string): boolean {
    return url === '/api/placeholder-flag.svg' || url.includes('placeholder');
  }
}

// Export singleton instance
export const flagService = new FlagService();

// Export the class for testing
export { FlagService }; 