// src/hooks/maps/useCities.ts
// Custom React hook for fetching country cities with filters

import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

/**
 * Type for city status filter
 */
export type CityStatus = "pending" | "approved" | "rejected" | "draft";

/**
 * Type for city type filter
 */
export type CityType = "capital" | "city" | "town" | "village";

/**
 * Input parameters for useCities hook
 */
export interface UseCitiesParams {
  /** Country ID to filter cities */
  countryId?: string;
  /** Filter by approval status */
  status?: CityStatus;
  /** Maximum number of cities to fetch */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Return type for useCities hook
 */
export interface UseCitiesResult {
  /** Array of cities matching the filters */
  cities: RouterOutputs["mapEditor"]["getMyCities"]["cities"];
  /** Total count of cities */
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
 * Custom hook for fetching country cities with filters.
 *
 * @example
 * ```tsx
 * const { cities, loading, error, refetch } = useCities({
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
 *     {cities.map(city => (
 *       <div key={city.id}>
 *         {city.name} ({city.type})
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @param params - Filter parameters for city query
 * @returns Object containing cities data, loading state, and refetch function
 */
export function useCities(params: UseCitiesParams = {}): UseCitiesResult {
  const {
    countryId,
    status,
    limit = 50,
    offset = 0,
  } = params;

  // Use the getMyCities endpoint to fetch user's cities
  const query = api.mapEditor.getMyCities.useQuery(
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

  // Wrap error to ensure it has a name property
  const wrappedError = query.error ? new Error(query.error.message || 'Unknown error') : null;

  return {
    cities: query.data?.cities ?? [],
    total: query.data?.total ?? 0,
    hasMore: query.data?.hasMore ?? false,
    loading: query.isLoading,
    error: wrappedError,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}

/**
 * Custom hook for fetching approved cities for any country (public endpoint).
 * This is useful for displaying approved cities on public maps.
 *
 * @example
 * ```tsx
 * const { cities, loading } = useCountryCities({
 *   countryId: "country_123",
 *   type: "capital"
 * });
 * ```
 *
 * @param params - Filter parameters for public city query
 * @returns Object containing cities data and loading state
 */
export function useCountryCities(params: {
  countryId: string;
  subdivisionId?: string;
  type?: CityType;
}) {
  const query = api.mapEditor.getCountryCities.useQuery(
    {
      countryId: params.countryId,
      subdivisionId: params.subdivisionId,
      type: params.type,
    },
    {
      staleTime: 60_000, // Cache for 1 minute
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch public data on window focus
      retry: 2,
      enabled: Boolean(params.countryId),
    }
  );

  // Wrap error to ensure it has a name property
  const wrappedError = query.error ? new Error(query.error.message || 'Unknown error') : null;

  return {
    cities: query.data?.cities ?? [],
    count: query.data?.count ?? 0,
    loading: query.isLoading,
    error: wrappedError,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}
