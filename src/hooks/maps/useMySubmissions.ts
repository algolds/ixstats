// src/hooks/maps/useMySubmissions.ts
// Custom React hook for fetching user's own submissions across all entity types

import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { useMemo } from "react";

/**
 * Type for submission status filter
 */
export type SubmissionStatus = "pending" | "approved" | "rejected" | "draft";

/**
 * Type for entity type filter
 */
export type EntityType = "subdivision" | "city" | "poi" | "all";

/**
 * Combined submission type that can represent any entity type
 */
export type Submission =
  | {
      entityType: "subdivision";
      data: RouterOutputs["mapEditor"]["getMySubdivisions"]["subdivisions"][0];
    }
  | {
      entityType: "city";
      data: RouterOutputs["mapEditor"]["getMyCities"]["cities"][0];
    }
  | {
      entityType: "poi";
      data: RouterOutputs["mapEditor"]["getMyPOIs"]["pois"][0];
    };

/**
 * Input parameters for useMySubmissions hook
 */
export interface UseMySubmissionsParams {
  /** Filter by approval status */
  status?: SubmissionStatus;
  /** Filter by entity type */
  entityType?: EntityType;
  /** Country ID to filter submissions */
  countryId?: string;
  /** Maximum number of items to fetch per entity type */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Return type for useMySubmissions hook
 */
export interface UseMySubmissionsResult {
  /** Array of submissions across all entity types */
  submissions: Submission[];
  /** Total count of submissions */
  total: number;
  /** Whether any query is currently loading */
  loading: boolean;
  /** Combined error from any failed query */
  error: Error | null;
  /** Function to manually refetch all data */
  refetch: () => void;
  /** Whether any query is currently refetching */
  isRefetching: boolean;
  /** Breakdown by entity type */
  breakdown: {
    subdivisions: number;
    cities: number;
    pois: number;
  };
}

/**
 * Custom hook for fetching user's own submissions across all entity types.
 * This hook combines data from subdivisions, cities, and POIs endpoints.
 *
 * @example
 * ```tsx
 * const { submissions, loading, error, breakdown, refetch } = useMySubmissions({
 *   status: "pending",
 *   entityType: "all",
 *   countryId: "country_123"
 * });
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <div>
 *     <p>Total: {submissions.length}</p>
 *     <p>Subdivisions: {breakdown.subdivisions}</p>
 *     <p>Cities: {breakdown.cities}</p>
 *     <p>POIs: {breakdown.pois}</p>
 *     {submissions.map((sub, idx) => (
 *       <div key={idx}>
 *         {sub.entityType}: {sub.data.name}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @param params - Filter parameters for submissions query
 * @returns Object containing combined submissions data, loading state, and refetch function
 */
export function useMySubmissions(
  params: UseMySubmissionsParams = {}
): UseMySubmissionsResult {
  const {
    status,
    entityType = "all",
    countryId,
    limit = 50,
    offset = 0,
  } = params;

  // Fetch subdivisions if needed
  const subdivisionsQuery = api.mapEditor.getMySubdivisions.useQuery(
    {
      countryId,
      status,
      limit,
      offset,
    },
    {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      enabled: entityType === "all" || entityType === "subdivision",
    }
  );

  // Fetch cities if needed
  const citiesQuery = api.mapEditor.getMyCities.useQuery(
    {
      countryId,
      status,
      limit,
      offset,
    },
    {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      enabled: entityType === "all" || entityType === "city",
    }
  );

  // Fetch POIs if needed
  const poisQuery = api.mapEditor.getMyPOIs.useQuery(
    {
      countryId,
      status,
      limit,
      offset,
    },
    {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
      enabled: entityType === "all" || entityType === "poi",
    }
  );

  // Combine submissions from all entity types
  const submissions = useMemo(() => {
    const combined: Submission[] = [];

    // Add subdivisions
    if (entityType === "all" || entityType === "subdivision") {
      const subs = subdivisionsQuery.data?.subdivisions ?? [];
      subs.forEach((sub) => {
        combined.push({
          entityType: "subdivision",
          data: sub,
        });
      });
    }

    // Add cities
    if (entityType === "all" || entityType === "city") {
      const cities = citiesQuery.data?.cities ?? [];
      cities.forEach((city) => {
        combined.push({
          entityType: "city",
          data: city,
        });
      });
    }

    // Add POIs
    if (entityType === "all" || entityType === "poi") {
      const pois = poisQuery.data?.pois ?? [];
      pois.forEach((poi) => {
        combined.push({
          entityType: "poi",
          data: poi,
        });
      });
    }

    // Sort by creation date (most recent first)
    return combined.sort((a, b) => {
      const aDate = new Date(a.data.createdAt);
      const bDate = new Date(b.data.createdAt);
      return bDate.getTime() - aDate.getTime();
    });
  }, [subdivisionsQuery.data, citiesQuery.data, poisQuery.data, entityType]);

  // Calculate total and breakdown
  const total = useMemo(() => {
    if (entityType === "subdivision") {
      return subdivisionsQuery.data?.total ?? 0;
    } else if (entityType === "city") {
      return citiesQuery.data?.total ?? 0;
    } else if (entityType === "poi") {
      return poisQuery.data?.total ?? 0;
    } else {
      // For "all", sum the totals
      return (
        (subdivisionsQuery.data?.total ?? 0) +
        (citiesQuery.data?.total ?? 0) +
        (poisQuery.data?.total ?? 0)
      );
    }
  }, [subdivisionsQuery.data, citiesQuery.data, poisQuery.data, entityType]);

  const breakdown = useMemo(
    () => ({
      subdivisions: subdivisionsQuery.data?.subdivisions.length ?? 0,
      cities: citiesQuery.data?.cities.length ?? 0,
      pois: poisQuery.data?.pois.length ?? 0,
    }),
    [subdivisionsQuery.data, citiesQuery.data, poisQuery.data]
  );

  // Determine loading state
  const loading =
    subdivisionsQuery.isLoading || citiesQuery.isLoading || poisQuery.isLoading;

  // Determine refetching state
  const isRefetching =
    subdivisionsQuery.isRefetching ||
    citiesQuery.isRefetching ||
    poisQuery.isRefetching;

  // Combine errors
  const error =
    subdivisionsQuery.error ?? citiesQuery.error ?? poisQuery.error ?? null;

  // Refetch all queries
  const refetch = () => {
    void subdivisionsQuery.refetch();
    void citiesQuery.refetch();
    void poisQuery.refetch();
  };

  return {
    submissions,
    total,
    loading,
    error,
    refetch,
    isRefetching,
    breakdown,
  };
}
