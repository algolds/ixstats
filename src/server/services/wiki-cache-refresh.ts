/**
 * Wiki Cache Refresh Background Service
 * 
 * Periodically refreshes stale wiki cache entries and cleans up expired ones.
 * Prioritizes popular countries based on hit count.
 */

import { wikiCacheService } from "~/lib/services/wiki-cache-service";
import { db } from "~/server/db";

interface RefreshStats {
  refreshed: number;
  cleaned: number;
  failed: number;
  duration: number;
}

export class WikiCacheRefreshService {
  private isRunning = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Start the background refresh service
   * Refreshes stale entries every 6 hours
   * Cleans up expired entries every 24 hours
   */
  start() {
    if (this.isRunning) {
      console.log('[WikiCacheRefresh] Service already running');
      return;
    }

    console.log('[WikiCacheRefresh] Starting background refresh service');
    this.isRunning = true;

    // Refresh stale entries every 6 hours
    this.refreshInterval = setInterval(
      () => {
        void this.refreshStaleEntries();
      },
      6 * 60 * 60 * 1000 // 6 hours
    );

    // Clean up expired entries every 24 hours
    this.cleanupInterval = setInterval(
      () => {
        void this.cleanupExpiredEntries();
      },
      24 * 60 * 60 * 1000 // 24 hours
    );

    // Run initial refresh and cleanup immediately
    void this.refreshStaleEntries();
    void this.cleanupExpiredEntries();
  }

  /**
   * Stop the background refresh service
   */
  stop() {
    console.log('[WikiCacheRefresh] Stopping background refresh service');
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Manually trigger a refresh of stale entries
   */
  async refreshStaleEntries(): Promise<RefreshStats> {
    const startTime = Date.now();
    console.log('[WikiCacheRefresh] Starting refresh of stale entries');

    try {
      const refreshed = await wikiCacheService.refreshStaleEntries(2); // 2 hours threshold
      
      const stats: RefreshStats = {
        refreshed,
        cleaned: 0,
        failed: 0,
        duration: Date.now() - startTime,
      };

      console.log('[WikiCacheRefresh] Refresh complete:', stats);
      return stats;
    } catch (error) {
      console.error('[WikiCacheRefresh] Error during refresh:', error);
      
      return {
        refreshed: 0,
        cleaned: 0,
        failed: 1,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Manually trigger cleanup of expired entries
   */
  async cleanupExpiredEntries(): Promise<RefreshStats> {
    const startTime = Date.now();
    console.log('[WikiCacheRefresh] Starting cleanup of expired entries');

    try {
      const cleaned = await wikiCacheService.cleanupExpiredEntries();
      
      const stats: RefreshStats = {
        refreshed: 0,
        cleaned,
        failed: 0,
        duration: Date.now() - startTime,
      };

      console.log('[WikiCacheRefresh] Cleanup complete:', stats);
      return stats;
    } catch (error) {
      console.error('[WikiCacheRefresh] Error during cleanup:', error);
      
      return {
        refreshed: 0,
        cleaned: 0,
        failed: 1,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Warm cache for popular countries
   * Identifies countries with highest hit counts and pre-warms their cache
   */
  async warmPopularCountries(limit: number = 20): Promise<RefreshStats> {
    const startTime = Date.now();
    console.log(`[WikiCacheRefresh] Warming cache for top ${limit} popular countries`);

    try {
      // Get countries ordered by cache hit count
      const popularEntries = await db.wikiCache.findMany({
        where: {
          type: 'infobox', // Focus on country infoboxes
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
        console.log('[WikiCacheRefresh] No popular countries found to warm');
        return {
          refreshed: 0,
          cleaned: 0,
          failed: 0,
          duration: Date.now() - startTime,
        };
      }

      const result = await wikiCacheService.warmCache(countryNames);
      
      const stats: RefreshStats = {
        refreshed: result.success,
        cleaned: 0,
        failed: result.failed,
        duration: Date.now() - startTime,
      };

      console.log('[WikiCacheRefresh] Popular countries warmed:', stats);
      return stats;
    } catch (error) {
      console.error('[WikiCacheRefresh] Error warming popular countries:', error);
      
      return {
        refreshed: 0,
        cleaned: 0,
        failed: 1,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasRefreshInterval: !!this.refreshInterval,
      hasCleanupInterval: !!this.cleanupInterval,
    };
  }
}

// Export singleton instance
export const wikiCacheRefreshService = new WikiCacheRefreshService();

