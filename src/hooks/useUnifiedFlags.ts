// Unified Flag Hooks - Consolidates all flag loading approaches
// Replaces useFlag, useBulkFlagCache, useBatchFlags, etc.

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { improvedFlagService } from '~/lib/improved-flag-service';

// Single flag hook result
export interface UseFlagResult {
  flagUrl: string | null;
  isLoading: boolean;
  error: boolean;
  isLocal: boolean;
  isPlaceholder: boolean;
}

// Bulk flag hook result
export interface UseBulkFlagsResult {
  flagUrls: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;
  localCount: number;
  placeholderCount: number;
  refetch: () => Promise<void>;
}

// Flag preloader result
export interface UseFlagPreloaderResult {
  preloadFlags: (countryNames: string[]) => Promise<void>;
  isPreloading: boolean;
  preloadedCount: number;
}

/**
 * Hook for loading a single flag
 * 
 * @param countryName - The name of the country
 * @returns Flag data and loading state
 */
export function useFlag(countryName?: string): UseFlagResult {
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!countryName) {
      setFlagUrl(null);
      setIsLoading(false);
      setError(false);
      return;
    }

    let mounted = true;

    const loadFlag = async () => {
      try {
        setIsLoading(true);
        setError(false);

        // Try cached first for immediate response
        const cachedUrl = improvedFlagService.getCachedFlagUrl(countryName);
        if (cachedUrl && mounted) {
          setFlagUrl(cachedUrl);
          setIsLoading(false);
          return;
        }

        // Fetch if not cached
        const url = await improvedFlagService.getFlagUrl(countryName);
        
        if (mounted) {
          setFlagUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[useFlag] Error loading flag for ${countryName}:`, err);
        if (mounted) {
          setError(true);
          setIsLoading(false);
          setFlagUrl('/placeholder-flag.svg');
        }
      }
    };

    loadFlag();

    return () => {
      mounted = false;
    };
  }, [countryName]);

  const isLocal = flagUrl ? improvedFlagService.hasLocalFlag(countryName || '') : false;
  const isPlaceholder = flagUrl ? improvedFlagService.isPlaceholderFlag(flagUrl) : false;

  return {
    flagUrl,
    isLoading,
    error,
    isLocal,
    isPlaceholder,
  };
}

/**
 * Hook for loading multiple flags efficiently
 * 
 * @param countryNames - Array of country names
 * @returns Bulk flag data and loading state
 */
export function useBulkFlags(countryNames: string[]): UseBulkFlagsResult {
  const [flagUrls, setFlagUrls] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a stable key for the country names to prevent unnecessary re-renders
  const countryNamesKey = useMemo(() => {
    return countryNames.sort().join(',');
  }, [countryNames]);

  // Memoize the country names array to prevent unnecessary re-renders
  const memoizedCountryNames = useMemo(() => {
    return countryNames.sort();
  }, [countryNamesKey]);

  // Main fetch function
  const fetchFlags = useCallback(async (forceRefetch = false) => {
    if (memoizedCountryNames.length === 0) {
      setFlagUrls({});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get all cached flags immediately (unless force refetching)
      const cachedFlags: Record<string, string | null> = {};
      const uncachedCountries: string[] = [];
      
      if (!forceRefetch) {
        for (const countryName of memoizedCountryNames) {
          const cachedFlag = improvedFlagService.getCachedFlagUrl(countryName);
          if (cachedFlag) {
            cachedFlags[countryName] = cachedFlag;
          } else {
            uncachedCountries.push(countryName);
          }
        }
        
        // Set cached flags immediately for instant display
        console.log(`[useBulkFlags] Setting ${Object.keys(cachedFlags).length} cached flags`);
        setFlagUrls(cachedFlags);
      } else {
        uncachedCountries.push(...memoizedCountryNames);
      }
      
      // Step 2: Batch fetch uncached flags only if needed
      if (uncachedCountries.length > 0) {
        console.log(`[useBulkFlags] Batch loading ${uncachedCountries.length} uncached flags`);
        
        const fetchedFlags = await improvedFlagService.batchGetFlags(uncachedCountries);
        
        // Merge cached and fetched flags
        const finalFlags = { ...cachedFlags, ...fetchedFlags };
        console.log(`[useBulkFlags] Final flags for ${memoizedCountryNames.length} countries`);
        setFlagUrls(finalFlags);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useBulkFlags] Fetch failed:', error);
      
      // Set placeholder URLs for all countries on error
      const placeholderFlags: Record<string, string | null> = {};
      memoizedCountryNames.forEach(country => {
        placeholderFlags[country] = '/placeholder-flag.svg';
      });
      setFlagUrls(placeholderFlags);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedCountryNames]);

  // Initial fetch
  useEffect(() => {
    void fetchFlags();
  }, [fetchFlags]);

  // Refetch function for manual updates
  const refetch = useCallback(async () => {
    await fetchFlags(true);
  }, [fetchFlags]);

  // Calculate statistics
  const localCount = useMemo(() => {
    return Object.values(flagUrls).filter(url => 
      url && improvedFlagService.hasLocalFlag(url.replace('/flags/', '').split('.')[0] || '')
    ).length;
  }, [flagUrls]);

  const placeholderCount = useMemo(() => {
    return Object.values(flagUrls).filter(url => 
      url && improvedFlagService.isPlaceholderFlag(url)
    ).length;
  }, [flagUrls]);

  return {
    flagUrls,
    isLoading,
    error,
    localCount,
    placeholderCount,
    refetch,
  };
}

/**
 * Hook for preloading flags in the background
 * 
 * @returns Preloader functions and state
 */
export function useFlagPreloader(): UseFlagPreloaderResult {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedCount, setPreloadedCount] = useState(0);

  const preloadFlags = useCallback(async (countryNames: string[]) => {
    if (countryNames.length === 0 || isPreloading) {
      return;
    }

    setIsPreloading(true);
    setPreloadedCount(0);

    try {
      console.log(`[useFlagPreloader] Preloading ${countryNames.length} flags`);
      
      // Initialize the flag service with these countries (will trigger background downloading)
      await improvedFlagService.initialize(countryNames);
      
      setPreloadedCount(countryNames.length);
      console.log(`[useFlagPreloader] Preloading completed for ${countryNames.length} countries`);
    } catch (error) {
      console.error('[useFlagPreloader] Preloading failed:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [isPreloading]);

  return {
    preloadFlags,
    isPreloading,
    preloadedCount,
  };
}

/**
 * Hook for getting flag service statistics
 */
export function useFlagServiceStats() {
  const [stats, setStats] = useState(() => improvedFlagService.getStats());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Small delay to allow for any pending operations
      await new Promise(resolve => setTimeout(resolve, 100));
      setStats(improvedFlagService.getStats());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh stats periodically
  useEffect(() => {
    const interval = setInterval(refresh, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    stats,
    refresh,
    isRefreshing,
  };
}

// Legacy compatibility exports (for easier migration)
export const useBulkFlagCache = useBulkFlags;
export const useBatchFlags = useBulkFlags;

export default useFlag;