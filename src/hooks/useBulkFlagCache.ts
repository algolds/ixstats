// src/hooks/useBulkFlagCache.ts
"use client";

import { useState, useEffect, useMemo } from "react";
import { flagService } from "~/lib/flag-service";

export interface BulkFlagCacheHook {
  flagUrls: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * React hook for fetching all cached flag URLs for multiple countries at once
 */
export function useBulkFlagCache(countryNames: string[]): BulkFlagCacheHook {
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

  // Fetch flags when country names change
  useEffect(() => {
    const fetchFlags = async () => {
      if (memoizedCountryNames.length === 0) {
        setFlagUrls({});
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Get all cached flags immediately
        const cachedFlags: Record<string, string | null> = {};
        const uncachedCountries: string[] = [];
        
        for (const countryName of memoizedCountryNames) {
          const cachedFlag = flagService.getCachedFlagUrl(countryName);
          if (cachedFlag) {
            cachedFlags[countryName] = cachedFlag;
          } else {
            uncachedCountries.push(countryName);
          }
        }
        
        // Set cached flags immediately for instant display
        console.log(`[BulkFlagCache] Setting ${Object.keys(cachedFlags).length} cached flags:`, cachedFlags);
        setFlagUrls(cachedFlags);
        
        // Step 2: Fetch uncached flags only if needed
        if (uncachedCountries.length > 0) {
          console.log(`[BulkFlagCache] Loading ${uncachedCountries.length} uncached flags:`, uncachedCountries);
          
          const fetchedFlags: Record<string, string | null> = {};
          await Promise.allSettled(
            uncachedCountries.map(async (countryName) => {
              try {
                const url = await flagService.getFlagUrl(countryName);
                console.log(`[BulkFlagCache] Got URL for ${countryName}:`, url);
                fetchedFlags[countryName] = url;
              } catch (err) {
                console.warn(`[BulkFlagCache] Failed to get URL for ${countryName}:`, err);
                fetchedFlags[countryName] = null;
              }
            })
          );
          
          // Merge cached and fetched flags
          const finalFlags = { ...cachedFlags, ...fetchedFlags };
          console.log(`[BulkFlagCache] Final flags for ${memoizedCountryNames.length} countries:`, finalFlags);
          setFlagUrls(finalFlags);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        console.error('[BulkFlagCache] Fetch failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFlags();
  }, [memoizedCountryNames]);

  const refetch = async () => {
    if (memoizedCountryNames.length === 0) {
      setFlagUrls({});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const flagUrls: Record<string, string | null> = {};
      await Promise.allSettled(
        memoizedCountryNames.map(async (countryName) => {
          try {
            flagUrls[countryName] = await flagService.getFlagUrl(countryName);
          } catch (err) {
            flagUrls[countryName] = null;
          }
        })
      );
      setFlagUrls(flagUrls);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('[BulkFlagCache] Refetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    flagUrls,
    isLoading,
    error,
    refetch,
  };
} 