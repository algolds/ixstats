// src/hooks/useFlagPreloader.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ixnayWiki } from "~/lib/mediawiki-service";

interface PreloaderStats {
  flags: number;
  preloadedFlags: number;
  failedFlags: number;
  infoboxes: number;
  templates: number;
  files: number;
  cacheEfficiency: number;
}

// Modified interface to include currentStats
interface GlobalFlagPreloader {
  preloadAllFlags: (countryNames: string[]) => Promise<void>;
  getGlobalStats: () => PreloaderStats; // Kept for potential direct use, but be cautious with effects
  clearCache: () => void;
  isPreloading: boolean;
  currentStats: PreloaderStats; // Added to directly access stats
  lastPreloadTime: number | null;
}

/**
 * Global flag preloader hook for managing MediaWiki flag cache across the application
 */
export function useGlobalFlagPreloader(): GlobalFlagPreloader {
  const [isPreloading, setIsPreloading] = useState(false);
  const [lastPreloadTime, setLastPreloadTime] = useState<number | null>(null);
  const [stats, setStats] = useState<PreloaderStats>({
    flags: 0,
    preloadedFlags: 0,
    failedFlags: 0,
    infoboxes: 0,
    templates: 0,
    files: 0,
    cacheEfficiency: 0,
  });

  // Use ref to avoid recreating the function on every render
  const updateStatsRef = useRef<() => void>(() => {});

  // Update stats from the MediaWiki service
  const updateStats = useCallback(() => {
    const serviceStats = ixnayWiki.getCacheStats();
    const newStats: PreloaderStats = {
      flags: serviceStats.flags,
      preloadedFlags: serviceStats.preloadedFlags,
      failedFlags: serviceStats.failedFlags,
      infoboxes: serviceStats.infoboxes || 0,
      templates: serviceStats.templates || 0,
      files: serviceStats.files || 0,
      cacheEfficiency: serviceStats.cacheEfficiency || 0,
    };
    setStats(newStats);
  }, []);

  updateStatsRef.current = updateStats;

  // Preload flags for multiple countries with improved batching and caching
  const preloadAllFlags = useCallback(async (countryNames: string[]) => {
    if (countryNames.length === 0) return;

    setIsPreloading(true);
    const startTime = Date.now();
    
    try {
      console.log(`[FlagPreloader] Starting intelligent preload for ${countryNames.length} countries`);
      
      // Check which countries already have cached flags
      const cacheStats = ixnayWiki.getCacheStats();
      console.log(`[FlagPreloader] Current cache state: ${cacheStats.flags} flags cached`);
      
      // The service will handle filtering out already cached items
      await ixnayWiki.preloadCountryFlags(countryNames);
      
      const endTime = Date.now();
      console.log(`[FlagPreloader] Intelligent preload completed in ${endTime - startTime}ms`);
      
      // Update cache stats
      const newCacheStats = ixnayWiki.getCacheStats();
      console.log(`[FlagPreloader] Cache after preload: ${newCacheStats.flags} flags cached (added ${newCacheStats.flags - cacheStats.flags})`);
      
      setLastPreloadTime(endTime);
    } catch (error) {
      console.error('[FlagPreloader] Preload failed:', error);
    } finally {
      setIsPreloading(false);
      updateStatsRef.current?.(); // Update stats after preloading is done
    }
  }, []);

  // Get current cache statistics
  const getGlobalStats = useCallback(() => {
    updateStatsRef.current?.();
    return stats;
  }, [stats]);

  // Clear the cache
  const clearCache = useCallback(() => {
    ixnayWiki.clearCache();
    setLastPreloadTime(null);
    updateStatsRef.current?.();
  }, []);

  // Update stats on mount and periodically
  useEffect(() => {
    updateStatsRef.current?.();
    
    // Update stats every 30 seconds
    const interval = setInterval(() => {
      updateStatsRef.current?.();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    preloadAllFlags,
    getGlobalStats,
    clearCache,
    isPreloading,
    currentStats: stats,
    lastPreloadTime,
  };
}

/**
 * Individual country flag preloader hook with improved caching
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
      if (typeof url === 'string') {
        setFlagUrl(url);
      } else {
        setError(url.error);
        setFlagUrl(null);
      }
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
    } else {
      setFlagUrl(null);
      setIsLoading(false);
      setError(null);
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
 * Flag URL retrieval hook for individual countries with improved performance and caching
 */
export function useFlagUrl(countryName: string) {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countryName) {
      setFlagUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const loadFlag = async () => {
      try {
        // The service will check cache first, so this is efficient
        const url = await ixnayWiki.getFlagUrl(countryName);
        if (isMounted) {
          if (typeof url === 'string') {
            setFlagUrl(url);
            setError(null);
          } else {
            setError(url.error);
            setFlagUrl(null);
          }
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          // Only warn if it's not a rate limit error (which we expect during heavy loading)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('429') && !errorMessage.includes('Too Many Requests')) {
            console.warn(`Failed to load flag for ${countryName}:`, error);
          }
          setError(errorMessage);
          setFlagUrl(null);
          setIsLoading(false);
        }
      }
    };

    // Small delay to allow batch preloading to complete first
    const timer = setTimeout(loadFlag, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [countryName]);

  return { flagUrl, isLoading, error };
}

/**
 * Batch flag preloader for multiple countries at once
 */
export function useBatchFlagPreloader() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  const preloadFlags = useCallback(async (countryNames: string[]) => {
    if (countryNames.length === 0) return;

    setIsLoading(true);
    setProgress({ loaded: 0, total: countryNames.length });
    setErrors([]);

    try {
      // Use the improved preloading from the service
      await ixnayWiki.preloadCountryFlags(countryNames);
      setProgress({ loaded: countryNames.length, total: countryNames.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch preload failed';
      setErrors([errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    preloadFlags,
    isLoading,
    progress,
    errors,
  };
}