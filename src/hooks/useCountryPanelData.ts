"use client";

/**
 * useCountryPanelData - Fetches lightweight summary, neighbors,
 * sovereignty, wiki sections, and wiki images for the map info panel.
 * All data is pre-warmed on app init via useMapPrefetch, so queries
 * resolve instantly from cache on click.
 *
 * IMPORTANT: Wiki queries use `displayName` (from GeoJSON _displayName)
 * as the cache key, NOT summary.name. This ensures cache hits match
 * the keys seeded during bulk prefetch in useMapPrefetch.
 */

import { api } from "~/trpc/react";

/** Shared cache options for data that's bulk-warmed on init */
const WARMED_QUERY_OPTS = {
  staleTime: 24 * 60 * 60_000,  // 24 hours — static data, matches prefetch staleTime
  gcTime: 48 * 60 * 60_000,     // 48 hours — survive long after panel closes
} as const;

const DB_QUERY_OPTS = {
  staleTime: 10 * 60_000,       // 10 min
  gcTime: 60 * 60_000,          // 1 hour
} as const;

export function useCountryPanelData(countryId: string | null, displayName?: string | null) {
  const { data: summary, isLoading: summaryLoading } =
    api.countries.getMapSummary.useQuery(
      { countryId: countryId! },
      { enabled: !!countryId, ...DB_QUERY_OPTS }
    );

  const { data: neighbors, isLoading: neighborsLoading } =
    api.geo.getNeighbors.useQuery(
      { countryId: countryId! },
      { enabled: !!countryId, ...DB_QUERY_OPTS }
    );

  const { data: sovereignty, isLoading: sovereigntyLoading } =
    api.geo.getCountrySovereignty.useQuery(
      { countryId: countryId! },
      { enabled: !!countryId, ...DB_QUERY_OPTS }
    );

  // Use displayName directly for wiki queries — this matches the prefetch cache key.
  // Only fall back to summary.name if displayName wasn't provided.
  const wikiName = displayName ?? summary?.name ?? null;

  const { data: wikiSections } =
    api.countries.getWikiSectionPreviews.useQuery(
      { countryName: wikiName! },
      { enabled: !!wikiName, ...WARMED_QUERY_OPTS }
    );

  const { data: wikiImages } =
    api.countries.getWikiPageImages.useQuery(
      { countryName: wikiName! },
      { enabled: !!wikiName, ...WARMED_QUERY_OPTS }
    );

  return {
    summary: summary ?? null,
    neighbors: neighbors ?? [],
    sovereignty: sovereignty ?? { sovereign: null, subjects: [] },
    wikiSections: wikiSections ?? null,
    wikiImages: wikiImages ?? null,
    isLoading: summaryLoading || neighborsLoading || sovereigntyLoading,
  };
}
