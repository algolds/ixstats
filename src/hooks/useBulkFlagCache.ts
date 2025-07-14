// src/hooks/useBulkFlagCache.ts
"use client";

import { useState, useEffect, useMemo } from "react";

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
        // Create comma-separated list of country names for the query parameter
        const countryParam = memoizedCountryNames.map(name => encodeURIComponent(name)).join(',');
        const url = `/api/flag-cache?action=flags&countries=${countryParam}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch flag cache');
        }

        const data = await response.json();
        if (data.success) {
          setFlagUrls(data.flags);
        } else {
          throw new Error(data.error || 'Failed to fetch flag cache');
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
      const countryParam = memoizedCountryNames.map(name => encodeURIComponent(name)).join(',');
      const url = `/api/flag-cache?action=flags&countries=${countryParam}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch flag cache');
      }

      const data = await response.json();
      if (data.success) {
        setFlagUrls(data.flags);
      } else {
        throw new Error(data.error || 'Failed to fetch flag cache');
      }
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