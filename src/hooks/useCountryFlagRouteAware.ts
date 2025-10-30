// Route-aware country flag hook that uses appropriate service based on current route
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  countryFlagService,
  countryFlagServiceCommonsOnly,
  type CountryFlag,
} from "~/lib/country-flag-service";

/**
 * Hook for a single country flag with route-aware service selection
 * - Uses Commons-only service on main builder page (/builder)
 * - Uses full service with IIWiki fallback on import page (/builder/import)
 */
export function useCountryFlagRouteAware(countryName: string) {
  const [flag, setFlag] = useState<CountryFlag | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // Determine which service to use based on current route
  const getService = useCallback(() => {
    if (pathname?.includes("/builder/import")) {
      // Use full service with IIWiki fallback on import page
      return countryFlagService;
    } else {
      // Use Commons-only service on main builder page and other routes
      return countryFlagServiceCommonsOnly;
    }
  }, [pathname]);

  const fetchFlag = useCallback(async () => {
    if (!countryName) return;

    setLoading(true);
    setError(null);

    try {
      const service = getService();
      const flagResult = await service.getCountryFlag(countryName);
      setFlag(flagResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch country flag";
      setError(errorMessage);
      console.error(`[useCountryFlagRouteAware] Error fetching flag for ${countryName}:`, err);
    } finally {
      setLoading(false);
    }
  }, [countryName, getService]);

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

/**
 * Hook for multiple country flags with route-aware service selection
 */
export function useCountryFlagsRouteAware(countries: string[], preload = true, batchSize = 5) {
  const [flags, setFlags] = useState<Map<string, CountryFlag>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // Determine which service to use based on current route
  const getService = useCallback(() => {
    if (pathname?.includes("/builder/import")) {
      // Use full service with IIWiki fallback on import page
      return countryFlagService;
    } else {
      // Use Commons-only service on main builder page and other routes
      return countryFlagServiceCommonsOnly;
    }
  }, [pathname]);

  const fetchFlags = useCallback(
    async (countryList: string[]) => {
      if (countryList.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        const service = getService();
        const flagResults = await service.batchGetCountryFlags(countryList);

        setFlags(flagResults);

        const stats = service.getCacheStats();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch country flags";
        setError(errorMessage);
        console.error("[useCountryFlagsRouteAware] Error fetching flags:", err);
      } finally {
        setLoading(false);
      }
    },
    [getService, pathname]
  );

  /**
   * Fetch a single flag
   */
  const refetchFlag = useCallback(
    async (countryName: string) => {
      try {
        const service = getService();
        const flag = await service.getCountryFlag(countryName);

        setFlags((prev) => new Map(prev).set(countryName, flag));
      } catch (err) {
        console.error(`[useCountryFlagsRouteAware] Error refetching flag for ${countryName}:`, err);
      }
    },
    [getService]
  );

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
    const service = getService();
    service.clearCache();
    setFlags(new Map());
    setError(null);
  }, [getService]);

  /**
   * Get cache statistics
   */
  const stats = {
    total: flags.size,
    successful: Array.from(flags.values()).filter((flag) => flag.flagUrl !== null).length,
    failed: flags.size - Array.from(flags.values()).filter((flag) => flag.flagUrl !== null).length,
    hitRate:
      flags.size > 0
        ? (Array.from(flags.values()).filter((flag) => flag.flagUrl !== null).length / flags.size) *
          100
        : 0,
  };

  // Fetch flags when countries change
  useEffect(() => {
    if (preload && countries.length > 0) {
      fetchFlags(countries);
    }
  }, [countries, preload, fetchFlags]);

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
