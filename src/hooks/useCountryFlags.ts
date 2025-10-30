// React hook for country flag management
import { useState, useEffect, useCallback, useMemo } from "react";
import { countryFlagService, type CountryFlag } from "~/lib/country-flag-service";

interface UseCountryFlagsOptions {
  countries: string[];
  preload?: boolean;
  batchSize?: number;
}

interface UseCountryFlagsReturn {
  flags: Map<string, CountryFlag>;
  loading: boolean;
  error: string | null;
  getFlag: (countryName: string) => CountryFlag | null;
  refetchFlag: (countryName: string) => Promise<void>;
  clearCache: () => void;
  stats: {
    total: number;
    successful: number;
    failed: number;
    hitRate: number;
  };
}

export function useCountryFlags(options: UseCountryFlagsOptions): UseCountryFlagsReturn {
  const { countries, preload = true, batchSize = 5 } = options;

  const [flags, setFlags] = useState<Map<string, CountryFlag>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the country list to prevent unnecessary re-fetches
  const memoizedCountries = useMemo(() => countries, [countries.join(",")]);

  /**
   * Fetch flags for all countries
   */
  const fetchFlags = useCallback(async (countryList: string[]) => {
    if (countryList.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const flagResults = await countryFlagService.batchGetCountryFlags(countryList);

      setFlags(flagResults);

      const stats = countryFlagService.getCacheStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch country flags";
      setError(errorMessage);
      console.error("[useCountryFlags] Error fetching flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch a single flag
   */
  const refetchFlag = useCallback(async (countryName: string) => {
    try {
      const flag = await countryFlagService.getCountryFlag(countryName);

      setFlags((prev) => new Map(prev).set(countryName, flag));
    } catch (err) {
      console.error(`[useCountryFlags] Error refetching flag for ${countryName}:`, err);
    }
  }, []);

  /**
   * Get a flag from the current state
   */
  const getFlag = useCallback(
    (countryName: string): CountryFlag | null => {
      return flags.get(countryName) || null;
    },
    [flags]
  );

  /**
   * Clear the flag cache
   */
  const clearCache = useCallback(() => {
    countryFlagService.clearCache();
    setFlags(new Map());
    setError(null);
  }, []);

  /**
   * Get cache statistics
   */
  const stats = useMemo(() => {
    const total = flags.size;
    const successful = Array.from(flags.values()).filter((flag) => flag.flagUrl !== null).length;
    const failed = total - successful;

    return {
      total,
      successful,
      failed,
      hitRate: total > 0 ? (successful / total) * 100 : 0,
    };
  }, [flags]);

  // Fetch flags when countries change
  useEffect(() => {
    if (preload && memoizedCountries.length > 0) {
      fetchFlags(memoizedCountries);
    }
  }, [memoizedCountries, preload, fetchFlags]);

  return {
    flags,
    loading,
    error,
    getFlag,
    refetchFlag,
    clearCache,
    stats,
  };
}

/**
 * Hook for a single country flag
 */
export function useCountryFlag(countryName: string) {
  const [flag, setFlag] = useState<CountryFlag | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlag = useCallback(async () => {
    if (!countryName) return;

    setLoading(true);
    setError(null);

    try {
      const flagResult = await countryFlagService.getCountryFlag(countryName);
      setFlag(flagResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch country flag";
      setError(errorMessage);
      console.error(`[useCountryFlag] Error fetching flag for ${countryName}:`, err);
    } finally {
      setLoading(false);
    }
  }, [countryName]);

  useEffect(() => {
    fetchFlag();
  }, [fetchFlag]);

  return {
    flag,
    loading,
    error,
    refetch: fetchFlag,
  };
}
