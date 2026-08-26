// Unified Flag Hooks - Consolidates all flag loading approaches (Plan 164)
// Replaces useFlag, useBulkFlagCache, useBatchFlags, etc.

"use client";

import { useState, useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

const DEFAULT_PLACEHOLDER = "/images/flags/placeholder.svg";

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
 */
export function useFlag(countryName?: string): UseFlagResult {
  const cleanName = countryName?.replace(/ \(Demo\)$/, "").trim();
  const placeholderUrl = useMemo(() => withBasePath(DEFAULT_PLACEHOLDER), []);

  const { data: batchResult, isLoading, isError } = api.countries.flags.resolveBatch.useQuery(
    { countryNames: cleanName ? [cleanName] : [] },
    {
      enabled: Boolean(cleanName),
      staleTime: 1000 * 60 * 60, // 1 hour
      retry: 1,
    }
  );

  const rawUrl = cleanName && batchResult ? batchResult[cleanName] : null;
  const isPlaceholder = !rawUrl || rawUrl.includes("placeholder");
  const flagUrl = isPlaceholder ? placeholderUrl : rawUrl;

  return {
    flagUrl: cleanName ? flagUrl : null,
    isLoading: Boolean(cleanName) && isLoading,
    error: isError,
    isLocal: false,
    isPlaceholder,
  };
}

/**
 * Hook for loading multiple flags efficiently
 * Uses server-side resolver via tRPC and never mutates caller arrays.
 */
export function useBulkFlags(
  countryNames: readonly string[],
  _source: "irl" | "wiki" = "wiki"
): UseBulkFlagsResult {
  // oxlint-disable-next-line eslint/no-unused-vars
  const placeholderUrl = useMemo(() => withBasePath(DEFAULT_PLACEHOLDER), []);

  // Safe copied sort for dependency key without mutating input
  const countryNamesKey = useMemo(() => {
    return [...countryNames].sort().join(",");
  }, [countryNames]);

  const memoizedCountryNames = useMemo(() => {
    return [...countryNames].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryNamesKey]);

  const { data: batchResult, isLoading, error: trpcError, refetch: trpcRefetch } =
    api.countries.flags.resolveBatch.useQuery(
      { countryNames: memoizedCountryNames },
      {
        enabled: memoizedCountryNames.length > 0,
        staleTime: 1000 * 60 * 60, // 1 hour
        retry: 1,
      }
    );

  const flagUrls = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const name of memoizedCountryNames) {
      const url = batchResult ? batchResult[name] : null;
      result[name] = url ?? null;
    }
    return result;
  }, [memoizedCountryNames, batchResult]);

  const placeholderCount = useMemo(() => {
    return Object.values(flagUrls).filter(
      (url) => !url || url.includes("placeholder")
    ).length;
  }, [flagUrls]);

  const refetch = useCallback(async () => {
    await trpcRefetch();
  }, [trpcRefetch]);

  return {
    flagUrls,
    isLoading,
    error: trpcError ? trpcError.message : null,
    localCount: 0,
    placeholderCount,
    refetch,
  };
}

/**
 * Backward compatibility alias for useBulkFlags
 */
export const useBulkFlagCache = useBulkFlags;
export const useBatchFlags = useBulkFlags;

/**
 * Hook for preloading flags in the background
 */
export function useFlagPreloader(): UseFlagPreloaderResult {
  const utils = api.useUtils();
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedCount, setPreloadedCount] = useState(0);

  const preloadFlags = useCallback(
    async (countryNames: string[]) => {
      if (!countryNames.length) return;
      setIsPreloading(true);
      try {
        await utils.countries.flags.resolveBatch.prefetch({
          countryNames: [...countryNames],
        });
        setPreloadedCount((prev) => prev + countryNames.length);
      } catch (err) {
        console.warn("[useFlagPreloader] Preload error:", err);
      } finally {
        setIsPreloading(false);
      }
    },
    [utils]
  );

  return {
    preloadFlags,
    isPreloading,
    preloadedCount,
  };
}
