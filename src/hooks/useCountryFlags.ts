// React hook for country flag management (Plan 164)
"use client";

import { useCallback, useMemo } from "react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

export interface CountryFlag {
  countryName: string;
  flagUrl: string | null;
  source:
    "provided" | "persistent-cache" | "memory-cache" | "commons" | "fictional-wiki" | "placeholder";
  cached: boolean;
  isPlaceholder: boolean;
}

export interface UseCountryFlagsOptions {
  countries: readonly string[];
  preload?: boolean;
  batchSize?: number;
}

export interface UseCountryFlagsReturn {
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
  const { countries } = options;
  const placeholderUrl = useMemo(() => withBasePath("/images/flags/placeholder.svg"), []);

  const memoizedCountryNames = useMemo(() => {
    return [...countries];
  }, [countries]);

  const {
    data: batchResult,
    isLoading,
    error: trpcError,
    refetch,
  } = api.countries.flags.resolveBatch.useQuery(
    { countryNames: memoizedCountryNames },
    {
      enabled: memoizedCountryNames.length > 0,
      staleTime: 1000 * 60 * 60,
      retry: 1,
    }
  );

  const flags = useMemo(() => {
    const map = new Map<string, CountryFlag>();
    for (const name of memoizedCountryNames) {
      const rawUrl = batchResult ? batchResult[name] : null;
      const isPlaceholder = !rawUrl || rawUrl.includes("placeholder");
      map.set(name, {
        countryName: name,
        flagUrl: isPlaceholder ? placeholderUrl : rawUrl,
        source: isPlaceholder ? "placeholder" : "commons",
        cached: Boolean(batchResult),
        isPlaceholder,
      });
    }
    return map;
  }, [memoizedCountryNames, batchResult, placeholderUrl]);

  const getFlag = useCallback(
    (countryName: string): CountryFlag | null => {
      return flags.get(countryName) || null;
    },
    [flags]
  );

  const refetchFlag = useCallback(
    async (_countryName: string) => {
      await refetch();
    },
    [refetch]
  );

  const clearCache = useCallback(() => {
    // No-op for tRPC query cache
  }, []);

  const stats = useMemo(() => {
    const total = flags.size;
    const successful = Array.from(flags.values()).filter((flag) => !flag.isPlaceholder).length;
    const failed = total - successful;
    const hitRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      hitRate,
    };
  }, [flags]);

  return {
    flags,
    loading: isLoading,
    error: trpcError ? trpcError.message : null,
    getFlag,
    refetchFlag,
    clearCache,
    stats,
  };
}

/**
 * Convenience hook for fetching a single country flag.
 */
export function useCountryFlag(countryName: string) {
  const cleanName = countryName?.trim() || "";
  const countries = useMemo(() => (cleanName ? [cleanName] : []), [cleanName]);
  const { flags, loading, error, refetchFlag } = useCountryFlags({ countries });
  const flag = cleanName ? (flags.get(cleanName) ?? null) : null;

  return {
    flag,
    loading: Boolean(cleanName) && loading,
    error,
    refetch: () => refetchFlag(cleanName),
  };
}
