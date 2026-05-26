"use client";

/**
 * useCountryMapEmbed - Data hook for country-focused map embeds.
 *
 * Fetches a single country's geometry, neighbors, cities, and POIs
 * via existing tRPC endpoints. All queries share cache settings with
 * the full world map (30min stale, 2hr gc).
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";

const MAP_CACHE = { staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 } as const;

export function useCountryMapEmbed(countryId: string | null | undefined) {
  const enabled = !!countryId;

  const { data: geoData, isLoading: geoLoading } = api.geoCore.getCountryGeometry.useQuery(
    { countryId: countryId! },
    { enabled, ...MAP_CACHE }
  );

  const { data: neighbors, isLoading: neighborsLoading } = api.geoCore.getNeighbors.useQuery(
    { countryId: countryId! },
    { enabled, ...MAP_CACHE }
  );

  const { data: features, isLoading: featuresLoading } = api.geoCore.getCountryFeatures.useQuery(
    { countryId: countryId! },
    { enabled, ...MAP_CACHE }
  );

  // Fetch world political layer for neighbor rendering (shared cache with main map)
  const { data: worldMap } = api.geoCore.getWorldMap.useQuery(
    { layers: ["political"] },
    { enabled, staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 }
  );

  return useMemo(() => {
    const cities = features?.cities ?? [];
    const capital = cities.find((c) => c.isNationalCapital) ?? null;

    return {
      // Geometry
      geometry: (geoData?.geometry as GeoJSON.Geometry) ?? null,
      centroid: geoData?.centroid ?? null,
      bbox: geoData?.bbox ?? null,
      displayName: geoData?.displayName ?? null,
      areaSqKm: geoData?.areaSqKm ?? null,
      fillColor: (geoData as { fillColor?: string } | undefined)?.fillColor ?? null,
      featureId: geoData?.featureId ?? null,

      // Country features
      cities,
      capital,
      pois: features?.pois ?? [],
      subdivisions: features?.subdivisions ?? [],

      // Neighbors
      neighbors: neighbors ?? [],

      // World political layer for greyed-out neighbor rendering
      worldPolitical: (worldMap as Record<string, unknown>)?.political as
        | import("geojson").FeatureCollection
        | undefined,

      // State
      isLoading: geoLoading || neighborsLoading || featuresLoading,
      hasGeometry: !!geoData?.geometry,
    };
  }, [geoData, neighbors, features, worldMap, geoLoading, neighborsLoading, featuresLoading]);
}
