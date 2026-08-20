// Route-aware country flag hook that uses appropriate service based on current route
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  countryFlagService,
  countryFlagServiceCommonsOnly,
  type CountryFlag,
} from "~/lib/flags/country-flag-service";

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
