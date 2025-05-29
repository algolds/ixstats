// src/hooks/useFlagPreloader.ts
"use client";

import { useEffect, useCallback } from 'react';
import { ixnayWiki } from '~/lib/mediawiki-service';

interface UseFlagPreloaderOptions {
  enabled?: boolean;
  preloadOnMount?: boolean;
}

interface FlagPreloaderStats {
  totalFlags: number;
  preloadedFlags: number;
  failedFlags: number;
  cacheHitRate: number;
}

export function useFlagPreloader(
  countryNames: string[],
  options: UseFlagPreloaderOptions = {}
) {
  const { enabled = true, preloadOnMount = true } = options;

  // Preload flags for the given countries
  const preloadFlags = useCallback(async () => {
    if (!enabled || countryNames.length === 0) return;

    try {
      await ixnayWiki.preloadCountryFlags(countryNames);
    } catch (error) {
      console.warn('[FlagPreloader] Failed to preload flags:', error);
    }
  }, [countryNames, enabled]);

  // Get cache statistics
  const getCacheStats = useCallback((): FlagPreloaderStats => {
    const stats = ixnayWiki.getCacheStats();
    const cacheHitRate = stats.flags > 0 ? (stats.preloadedFlags / stats.flags) * 100 : 0;

    return {
      totalFlags: stats.flags,
      preloadedFlags: stats.preloadedFlags,
      failedFlags: stats.failedFlags,
      cacheHitRate: Math.round(cacheHitRate)
    };
  }, []);

  // Clear flag cache
  const clearCache = useCallback(() => {
    ixnayWiki.clearCache();
  }, []);

  // Preload individual flag
  const preloadFlag = useCallback(async (countryName: string) => {
    if (!enabled) return null;

    try {
      return await ixnayWiki.getFlagUrl(countryName);
    } catch (error) {
      console.warn(`[FlagPreloader] Failed to preload flag for ${countryName}:`, error);
      return null;
    }
  }, [enabled]);

  // Effect to preload flags on mount
  useEffect(() => {
    if (preloadOnMount && enabled && countryNames.length > 0) {
      // Delay to avoid blocking initial render
      const timeoutId = setTimeout(() => {
        preloadFlags();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [preloadFlags, preloadOnMount, enabled, countryNames.length]);

  return {
    preloadFlags,
    preloadFlag,
    getCacheStats,
    clearCache,
    isEnabled: enabled
  };
}

// Global flag preloader for app-wide use
export function useGlobalFlagPreloader() {
  const preloadAllFlags = useCallback(async (countryNames: string[]) => {
    if (countryNames.length === 0) return;

    try {
      // Store country list for future sessions
      if (typeof window !== 'undefined') {
        localStorage.setItem('ixstats_countries', JSON.stringify(countryNames));
      }

      // Preload flags
      await ixnayWiki.preloadCountryFlags(countryNames);
      
      console.log(`[FlagPreloader] Successfully initiated preloading for ${countryNames.length} countries`);
    } catch (error) {
      console.warn('[FlagPreloader] Global preload failed:', error);
    }
  }, []);

  const getGlobalStats = useCallback(() => {
    const stats = ixnayWiki.getCacheStats();
    
    return {
      ...stats,
      cacheEfficiency: stats.flags > 0 ? Math.round((stats.preloadedFlags / stats.flags) * 100) : 0,
      errorRate: stats.flags > 0 ? Math.round((stats.failedFlags / stats.flags) * 100) : 0
    };
  }, []);

  return {
    preloadAllFlags,
    getGlobalStats,
    clearAllCaches: () => ixnayWiki.clearCache()
  };
}