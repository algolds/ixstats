// src/hooks/maps/useSubdivisions.ts
// Custom React hook for fetching country subdivisions with filters

import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

/**
 * Type for subdivision status filter
 */
export type SubdivisionStatus = "pending" | "approved" | "rejected" | "draft";

/**
 * Type for subdivision level filter (1-5 administrative levels)
 */
export type SubdivisionLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Input parameters for useSubdivisions hook
 */
export interface UseSubdivisionsParams {
  /** Country ID to filter subdivisions */
  countryId?: string;
  /** Filter by approval status */
  status?: SubdivisionStatus;
  /** Filter by administrative level (1-5) */
  level?: SubdivisionLevel;
  /** Maximum number of subdivisions to fetch */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Return type for useSubdivisions hook
 */
export interface UseSubdivisionsResult {
  /** Array of subdivisions matching the filters */
  subdivisions: RouterOutputs["mapEditor"]["getMySubdivisions"]["subdivisions"];
  /** Total count of subdivisions */
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
 * Custom hook for fetching country subdivisions with filters.
 *
 * @example
 * ```tsx
 * const { subdivisions, loading, error, refetch } = useSubdivisions({
 *   countryId: "country_123",
 *   status: "approved",
 *   level: 1,
 *   limit: 50
 * });
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <div>
 *     {subdivisions.map(sub => (
 *       <div key={sub.id}>{sub.name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @param params - Filter parameters for subdivision query
 * @returns Object containing subdivisions data, loading state, and refetch function
 */
export function useSubdivisions(params: UseSubdivisionsParams = {}): UseSubdivisionsResult {
  const {
    countryId,
    status,
    limit = 50,
    offset = 0,
  } = params;

  // Use the getMySubdivisions endpoint to fetch user's subdivisions
  const query = api.mapEditor.getMySubdivisions.useQuery(
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
      // Enable query only if we have necessary params
      enabled: true,
    }
  );

  // Filter by level on the client side since the API doesn't support it
  const filteredSubdivisions = params.level
    ? query.data?.subdivisions.filter(sub => sub.level === params.level) ?? []
    : query.data?.subdivisions ?? [];

  // Wrap error to ensure it has a name property
  const wrappedError = query.error ? new Error(query.error.message || 'Unknown error') : null;

  return {
    subdivisions: filteredSubdivisions,
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
 * Custom hook for fetching approved subdivisions for any country (public endpoint).
 * This is useful for displaying approved subdivisions on public maps.
 *
 * @example
 * ```tsx
 * const { subdivisions, loading } = useCountrySubdivisions({
 *   countryId: "country_123",
 *   includeGeometry: true
 * });
 * ```
 *
 * @param countryId - The country ID to fetch subdivisions for
 * @param includeGeometry - Whether to include GeoJSON geometry in the response
 * @returns Object containing subdivisions data and loading state
 */
export function useCountrySubdivisions(
  countryId: string,
  includeGeometry = true
) {
  const query = api.mapEditor.getCountrySubdivisions.useQuery(
    {
      countryId,
      includeGeometry,
    },
    {
      staleTime: 60_000, // Cache for 1 minute
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch public data on window focus
      retry: 2,
      enabled: Boolean(countryId),
    }
  );

  // Wrap error to ensure it has a name property
  const wrappedError = query.error ? new Error(query.error.message || 'Unknown error') : null;

  return {
    subdivisions: query.data?.subdivisions ?? [],
    count: query.data?.count ?? 0,
    loading: query.isLoading,
    error: wrappedError,
    refetch: () => {
      void query.refetch();
    },
    isRefetching: query.isRefetching,
  };
}
