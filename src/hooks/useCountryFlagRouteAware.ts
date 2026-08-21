// Route-aware country flag hook (Plan 164)
"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import type { CountryFlag } from "./useCountryFlags";

export type { CountryFlag };

/**
 * Hook for a single country flag with route-aware service selection
 * - Uses Commons-only service on main builder page (/builder)
 * - Uses full service with IIWiki fallback on import page (/builder/import)
 */
export function useCountryFlagRouteAware(countryName: string) {
  const pathname = usePathname();
  const cleanName = countryName?.trim();
  const placeholderUrl = useMemo(() => withBasePath("/images/flags/placeholder.svg"), []);

  const fallbackPolicy = useMemo(() => {
    return pathname?.includes("/builder/import") ? "fictional-wiki" : "commons-only";
  }, [pathname]);

  const { data: batchResult, isLoading, error: trpcError, refetch } =
    api.countries.flags.resolveBatch.useQuery(
      {
        countryNames: cleanName ? [cleanName] : [],
        fallbackPolicy,
      },
      {
        enabled: Boolean(cleanName),
        staleTime: 1000 * 60 * 60,
        retry: 1,
      }
    );

  const rawUrl = cleanName && batchResult ? batchResult[cleanName] : null;
  const isPlaceholder = !rawUrl || rawUrl.includes("placeholder");

  const flag: CountryFlag | null = useMemo(() => {
    if (!cleanName) return null;
    return {
      countryName: cleanName,
      flagUrl: isPlaceholder ? placeholderUrl : rawUrl,
      source: isPlaceholder
        ? "placeholder"
        : fallbackPolicy === "fictional-wiki"
        ? "fictional-wiki"
        : "commons",
      cached: Boolean(batchResult),
      isPlaceholder,
    };
  }, [cleanName, isPlaceholder, placeholderUrl, rawUrl, batchResult, fallbackPolicy]);

  return {
    flag,
    loading: Boolean(cleanName) && isLoading,
    error: trpcError ? trpcError.message : null,
    refetch,
  };
}
