// src/hooks/useBatchFlags.ts
// Hook for efficiently loading multiple flags at once

import { useState, useEffect } from 'react';
import { flagService } from '~/lib/flag-service';

export interface UseBatchFlagsResult {
  flags: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
}

export function useBatchFlags(countryNames: string[]): UseBatchFlagsResult {
  const [flags, setFlags] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countryNamesStr = JSON.stringify(countryNames.sort()); // For dependency comparison

  useEffect(() => {
    if (countryNames.length === 0) {
      setFlags({});
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;

    const loadFlags = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load flags in batch for better performance
        const flagResults = await flagService.batchGetFlags(countryNames);

        if (mounted) {
          setFlags(flagResults);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[useBatchFlags] Error loading flags:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    loadFlags();

    return () => {
      mounted = false;
    };
  }, [countryNamesStr]);

  const loadedCount = Object.values(flags).filter(url => url !== null).length;

  return {
    flags,
    isLoading,
    error,
    loadedCount,
    totalCount: countryNames.length,
  };
}

export default useBatchFlags;