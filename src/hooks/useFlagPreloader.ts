// src/hooks/useFlagPreloader.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { ixnayWiki } from "~/lib/mediawiki-service";

interface PreloaderStats {
  flags: number;
  preloadedFlags: number;
  failedFlags: number;
  cacheEfficiency: number;
}

interface GlobalFlagPreloader {
  preloadAllFlags: (countryNames: string[]) => Promise<void>;
  getGlobalStats: () => PreloaderStats;
  clearCache: () => void;
  isPreloading: boolean;
}

/**
 * Global flag preloader hook for managing MediaWiki flag cache across the application
 */
export function useGlobalFlagPreloader(): GlobalFlagPreloader {
  const [isPreloading, setIsPreloading] = useState(false);
  const [stats, setStats] = useState<PreloaderStats>({
    flags: 0,
    preloadedFlags: 0,
    failedFlags: 0,
    cacheEfficiency: 0,
  });

  // Update stats from the MediaWiki service
  const updateStats = useCallback(() => {
    const serviceStats = ixnayWiki.getCacheStats();
    const newStats: PreloaderStats = {
      flags: serviceStats.flags,
      preloadedFlags: serviceStats.preloadedFlags,
      failedFlags: serviceStats.failedFlags,
      cacheEfficiency: serviceStats.flags > 0 
        ? Math.round((serviceStats.preloadedFlags / serviceStats.flags) * 100)
        : 0,
    };
    setStats(newStats);
  }, []);

  // Preload flags for multiple countries
  const preloadAllFlags = useCallback(async (countryNames: string[]) => {
    if (countryNames.length === 0) return;

    setIsPreloading(true);
    try {
      console.log(`[FlagPreloader] Starting preload for ${countryNames.length} countries`);
      await ixnayWiki.preloadCountryFlags(countryNames);
      console.log(`[FlagPreloader] Preload completed`);
    } catch (error) {
      console.error('[FlagPreloader] Preload failed:', error);
    } finally {
      setIsPreloading(false);
      updateStats();
    }
  }, [updateStats]);

  // Get current cache statistics
  const getGlobalStats = useCallback(() => {
    updateStats();
    return stats;
  }, [stats, updateStats]);

  // Clear the cache
  const clearCache = useCallback(() => {
    ixnayWiki.clearCache();
    updateStats();
  }, [updateStats]);

  // Update stats on mount
  useEffect(() => {
    updateStats();
  }, [updateStats]);

  return {
    preloadAllFlags,
    getGlobalStats,
    clearCache,
    isPreloading,
  };
}

/**
 * Individual country flag preloader hook
 */
export function useFlagPreloader(countryName?: string) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFlag = useCallback(async (name: string) => {
    if (!name) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = await ixnayWiki.getFlagUrl(name);
      setFlagUrl(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load flag';
      setError(errorMessage);
      setFlagUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load flag when country name changes
  useEffect(() => {
    if (countryName) {
      loadFlag(countryName);
    }
  }, [countryName, loadFlag]);

  return {
    flagUrl,
    isLoading,
    error,
    reload: () => countryName && loadFlag(countryName),
  };
}

/**
 * Flag URL retrieval hook for individual countries
 */
export function useFlagUrl(countryName: string) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!countryName) {
      setFlagUrl(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadFlag = async () => {
      try {
        const url = await ixnayWiki.getFlagUrl(countryName);
        if (isMounted) {
          setFlagUrl(url);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          console.warn(`Failed to load flag for ${countryName}:`, error);
          setFlagUrl(null);
          setIsLoading(false);
        }
      }
    };

    loadFlag();

    return () => {
      isMounted = false;
    };
  }, [countryName]);

  return { flagUrl, isLoading };
}