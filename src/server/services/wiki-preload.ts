/**
 * Wiki Cache Preload Service
 * 
 * Pre-populates wiki cache on deployment and provides manual warm-up capabilities.
 * Useful for ensuring fast initial page loads and preparing for major wiki updates.
 */

import { wikiCacheService } from "~/lib/services/wiki-cache-service";
import { db } from "~/server/db";

interface PreloadResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  duration: number;
  countries: string[];
}

export class WikiPreloadService {
  private isPreloading = false;

  /**
   * Preload cache for all active countries
   * Typically called on deployment or after major wiki updates
   */
  async preloadAllCountries(maxCountries: number = 100): Promise<PreloadResult> {
    if (this.isPreloading) {
      throw new Error('Preload already in progress');
    }

    const startTime = Date.now();
    this.isPreloading = true;

    try {
      console.log(`[WikiPreload] Starting preload for up to ${maxCountries} countries`);

      // Get all active countries from database
      const countries = await db.country.findMany({
        select: {
          name: true,
          id: true,
        },
        take: maxCountries,
        orderBy: {
          createdAt: 'desc', // Prioritize newer countries
        },
      });

      const countryNames = countries.map(c => c.name);
      
      console.log(`[WikiPreload] Found ${countryNames.length} countries to preload`);

      if (countryNames.length === 0) {
        return {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
          duration: Date.now() - startTime,
          countries: [],
        };
      }

      // Warm cache for all countries
      const result = await wikiCacheService.warmCache(countryNames);

      const preloadResult: PreloadResult = {
        total: countryNames.length,
        success: result.success,
        failed: result.failed,
        skipped: 0,
        duration: Date.now() - startTime,
        countries: countryNames,
      };

      console.log('[WikiPreload] Preload complete:', preloadResult);
      return preloadResult;
    } catch (error) {
      console.error('[WikiPreload] Error during preload:', error);
      throw error;
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload cache for specific countries
   */
  async preloadCountries(countryNames: string[]): Promise<PreloadResult> {
    if (this.isPreloading) {
      throw new Error('Preload already in progress');
    }

    const startTime = Date.now();
    this.isPreloading = true;

    try {
      console.log(`[WikiPreload] Starting preload for ${countryNames.length} specific countries`);

      const result = await wikiCacheService.warmCache(countryNames);

      const preloadResult: PreloadResult = {
        total: countryNames.length,
        success: result.success,
        failed: result.failed,
        skipped: 0,
        duration: Date.now() - startTime,
        countries: countryNames,
      };

      console.log('[WikiPreload] Preload complete:', preloadResult);
      return preloadResult;
    } catch (error) {
      console.error('[WikiPreload] Error during preload:', error);
      throw error;
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload cache for countries by continent
   */
  async preloadByContinent(continent: string, maxCountries: number = 50): Promise<PreloadResult> {
    if (this.isPreloading) {
      throw new Error('Preload already in progress');
    }

    const startTime = Date.now();
    this.isPreloading = true;

    try {
      console.log(`[WikiPreload] Starting preload for ${continent} countries`);

      // Get countries from specific continent
      const countries = await db.country.findMany({
        where: {
          continent: {
            equals: continent,
          },
        },
        select: {
          name: true,
        },
        take: maxCountries,
      });

      const countryNames = countries.map(c => c.name);
      
      console.log(`[WikiPreload] Found ${countryNames.length} countries in ${continent}`);

      if (countryNames.length === 0) {
        return {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
          duration: Date.now() - startTime,
          countries: [],
        };
      }

      const result = await wikiCacheService.warmCache(countryNames);

      const preloadResult: PreloadResult = {
        total: countryNames.length,
        success: result.success,
        failed: result.failed,
        skipped: 0,
        duration: Date.now() - startTime,
        countries: countryNames,
      };

      console.log('[WikiPreload] Preload complete for continent:', preloadResult);
      return preloadResult;
    } catch (error) {
      console.error('[WikiPreload] Error during continent preload:', error);
      throw error;
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload cache for popular countries based on user activity
   */
  async preloadPopularCountries(limit: number = 30): Promise<PreloadResult> {
    if (this.isPreloading) {
      throw new Error('Preload already in progress');
    }

    const startTime = Date.now();
    this.isPreloading = true;

    try {
      console.log(`[WikiPreload] Starting preload for top ${limit} popular countries`);

      // Get countries with highest cache hit counts
      const popularEntries = await db.wikiCache.findMany({
        where: {
          type: 'infobox',
        },
        orderBy: {
          hitCount: 'desc',
        },
        take: limit,
        select: {
          countryName: true,
        },
      });

      const countryNames = popularEntries
        .map(entry => entry.countryName)
        .filter((name): name is string => name !== null);

      if (countryNames.length === 0) {
        console.log('[WikiPreload] No popular countries found in cache');
        
        // Fallback: Get recently viewed countries
        const recentCountries = await db.country.findMany({
          select: {
            name: true,
          },
          take: limit,
          orderBy: {
            updatedAt: 'desc',
          },
        });

        const fallbackNames = recentCountries.map(c => c.name);
        
        if (fallbackNames.length === 0) {
          return {
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            duration: Date.now() - startTime,
            countries: [],
          };
        }

        const result = await wikiCacheService.warmCache(fallbackNames);

        return {
          total: fallbackNames.length,
          success: result.success,
          failed: result.failed,
          skipped: 0,
          duration: Date.now() - startTime,
          countries: fallbackNames,
        };
      }

      const result = await wikiCacheService.warmCache(countryNames);

      const preloadResult: PreloadResult = {
        total: countryNames.length,
        success: result.success,
        failed: result.failed,
        skipped: 0,
        duration: Date.now() - startTime,
        countries: countryNames,
      };

      console.log('[WikiPreload] Popular countries preload complete:', preloadResult);
      return preloadResult;
    } catch (error) {
      console.error('[WikiPreload] Error during popular countries preload:', error);
      throw error;
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Check if preload is currently running
   */
  isCurrentlyPreloading(): boolean {
    return this.isPreloading;
  }

  /**
   * Get preload status and statistics
   */
  async getPreloadStats() {
    const cacheStats = await wikiCacheService.getCacheStats();
    
    return {
      isPreloading: this.isPreloading,
      cacheStats,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const wikiPreloadService = new WikiPreloadService();

/**
 * Initialize wiki cache on application startup (optional)
 * Call this from your server initialization code if you want automatic preloading
 */
export async function initializeWikiCache(options?: {
  preloadAll?: boolean;
  preloadPopular?: boolean;
  maxCountries?: number;
}) {
  const {
    preloadAll = false,
    preloadPopular = true,
    maxCountries = 30,
  } = options || {};

  try {
    console.log('[WikiPreload] Initializing wiki cache...');

    if (preloadAll) {
      console.log('[WikiPreload] Preloading all countries...');
      await wikiPreloadService.preloadAllCountries(maxCountries);
    } else if (preloadPopular) {
      console.log('[WikiPreload] Preloading popular countries...');
      await wikiPreloadService.preloadPopularCountries(maxCountries);
    }

    console.log('[WikiPreload] Wiki cache initialization complete');
  } catch (error) {
    console.error('[WikiPreload] Error initializing wiki cache:', error);
    // Don't throw - initialization errors shouldn't prevent app startup
  }
}

