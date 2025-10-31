// src/hooks/maps/usePOIs.ts
// Custom React hook for fetching country POIs with filters

import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

/**
 * Type for POI status filter
 */
export type POIStatus = "pending" | "approved" | "rejected" | "draft";

/**
 * Type for POI category filter (matches database enum)
 */
export type POICategory =
  | "monument"
  | "landmark"
  | "military"
  | "cultural"
  | "natural"
  | "religious"
  | "government";

/**
 * Input parameters for usePOIs hook
 */
export interface UsePOIsParams {
  /** Country ID to filter POIs */
  countryId?: string;
  /** Filter by approval status */
  status?: POIStatus;
  /** Maximum number of POIs to fetch */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Return type for usePOIs hook
 */
export interface UsePOIsResult {
  /** Array of POIs matching the filters */
  pois: RouterOutputs["mapEditor"]["getMyPOIs"]["pois"];
  /** Total count of POIs */
  total: number;
  /** Whether there are more results available */
  hasMore: boolean;
  /** Whether the query is currently loading */
  loading: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Function to manually refetch the data */
  refetch: () => void;
  /** Whether the query is currently refetching */
  isRefetching: boolean;
}

/**
 * Custom hook for fetching country POIs with filters.
 *
 * @example
 * ```tsx
 * const { pois, loading, error, refetch } = usePOIs({
 *   countryId: "country_123",
 *   status: "approved",
 *   limit: 50
 * });
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <div>
 *     {pois.map(poi => (
 *       <div key={poi.id}>
 *         {poi.name} - {poi.category}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @param params - Filter parameters for POI query
 * @returns Object containing POIs data, loading state, and refetch function
 */
export function usePOIs(params: UsePOIsParams = {}): UsePOIsResult {
  const {
    countryId,
    status,
    limit = 50,
    offset = 0,
  } = params;

  // Use the getMyPOIs endpoint to fetch user's POIs
  const query = api.mapEditor.getMyPOIs.useQuery(
    {
      countryId,
      status,
      limit,
      offset,
    },
    {
      // Cache data for 30 seconds to reduce unnecessary refetches
      staleTime: 30_000,
      // Keep data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Retry failed requests once
      retry: 1,
      // Enable query
      enabled: true,
    }
  );

  return {
    pois: query.data?.pois ?? [],
    total: query.data?.total ?? 0,
    hasMore: query.data?.hasMore ?? false,
    loading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}

/**
 * Custom hook for fetching approved POIs for any country (public endpoint).
 * This is useful for displaying approved POIs on public maps.
 *
 * @example
 * ```tsx
 * const { pois, loading } = useCountryPOIs({
 *   countryId: "country_123",
 *   category: "landmark"
 * });
 * ```
 *
 * @param params - Filter parameters for public POI query
 * @returns Object containing POIs data and loading state
 */
export function useCountryPOIs(params: {
  countryId: string;
  subdivisionId?: string;
  category?: POICategory;
}) {
  const query = api.mapEditor.getCountryPOIs.useQuery(
    {
      countryId: params.countryId,
      subdivisionId: params.subdivisionId,
      category: params.category,
    },
    {
      staleTime: 60_000, // Cache for 1 minute
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch public data on window focus
      retry: 2,
      enabled: Boolean(params.countryId),
    }
  );

  return {
    pois: query.data?.pois ?? [],
    count: query.data?.count ?? 0,
    loading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}
