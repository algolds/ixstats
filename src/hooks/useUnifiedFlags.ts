"use client";
// Unified Flag Hooks - Consolidates all flag loading approaches (Plan 164)
// Replaces the old useFlag / bulk flag cache hooks.

import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

const DEFAULT_PLACEHOLDER = "/images/flags/placeholder.svg";

// Single flag hook result
interface UseFlagResult {
  flagUrl: string | null;
  isLoading: boolean;
  error: boolean;
  isLocal: boolean;
  isPlaceholder: boolean;
}

// Bulk flag hook result
interface UseBulkFlagsResult {
  flagUrls: Record<string, string | null>;
  isLoading: boolean;
  error: string | null;
  localCount: number;
  placeholderCount: number;
  refetch: () => Promise<void>;
}

// Flag preloader result

/**
 * Hook for loading a single flag
 */
export function useFlag(countryName?: string): UseFlagResult {
  const cleanName = countryName?.replace(/ \(Demo\)$/, "").trim();
  const placeholderUrl = useMemo(() => withBasePath(DEFAULT_PLACEHOLDER), []);

  const {
    data: batchResult,
    isLoading,
    isError,
  } = api.countries.flags.resolveBatch.useQuery(
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
  source: "irl" | "wiki" = "wiki"
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

  const fallbackPolicy = useMemo(() => {
    return source === "irl" ? ("commons-only" as const) : undefined;
  }, [source]);

  const {
    data: batchResult,
    isLoading,
    error: trpcError,
    refetch: trpcRefetch,
  } = api.countries.flags.resolveBatch.useQuery(
    {
      countryNames: memoizedCountryNames,
      ...(fallbackPolicy ? { fallbackPolicy } : {}),
    },
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
    return Object.values(flagUrls).filter((url) => !url || url.includes("placeholder")).length;
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
