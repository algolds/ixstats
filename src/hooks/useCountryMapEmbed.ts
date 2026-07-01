// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * useCountryMapEmbed - Data hook for country-focused map embeds.
 *
 * Fetches a single country's geometry, neighbors, cities, and POIs
 * via a single unified countryGeo.getCountryGeoBundle tRPC endpoint.
 * All queries share cache settings with the full world map (30min stale, 2hr gc).
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";

const MAP_CACHE = { staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 } as const;

export function useCountryMapEmbed(countryId: string | null | undefined) {
  const enabled = !!countryId;

  // Fetch the unified geographic bundle (contains geometry, neighbors, cities, POIs, subdivisions)
  const {
    data: bundle,
    isLoading: bundleLoading,
    dataUpdatedAt: bundleUpdatedAt,
  } = api.countryGeo.getCountryGeoBundle.useQuery({ countryId: countryId! }, { enabled, ...MAP_CACHE });

  // Fetch world political layer for neighbor rendering (shared cache with main map)
  const { data: worldMap, dataUpdatedAt: worldUpdatedAt } = api.geoCore.getWorldMap.useQuery(
    { layers: ["political"] },
    { enabled, staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 }
  );

  return useMemo(() => {
    const cities = bundle?.cities ?? [];
    const capital = cities.find((c) => c.isNationalCapital) ?? null;
    const rawBBox = bundle?.boundingBox as number[] | null;
    const bbox =
      rawBBox && rawBBox.length === 4
        ? { minLng: rawBBox[0], minLat: rawBBox[1], maxLng: rawBBox[2], maxLat: rawBBox[3] }
        : null;

    return {
      // Geometry
      geometry: (bundle?.geometry as GeoJSON.Geometry) ?? null,
      centroid: bundle?.centroid ?? null,
      bbox,
      displayName: bundle?.displayName ?? null,
      areaSqKm: bundle?.areaSqKm ?? null,
      fillColor: bundle?.fillColor ?? null,
      featureId: bundle?.featureId ?? null,

      // Country features
      cities,
      capital,
      pois: bundle?.pois ?? [],
      subdivisions: bundle?.subdivisions ?? [],

      // Neighbors
      neighbors: bundle?.neighbors ?? [],

      // World political layer for greyed-out neighbor rendering
      worldPolitical: (worldMap as Record<string, unknown>)?.political as
        | import("geojson").FeatureCollection
        | undefined,

      // State
      isLoading: bundleLoading,
      hasGeometry: !!bundle?.geometry,
      // Freshness token — changes when either query refetches (drives snapshot re-render).
      dataUpdatedAt: Math.max(bundleUpdatedAt ?? 0, worldUpdatedAt ?? 0),
    };
  }, [bundle, worldMap, bundleLoading, bundleUpdatedAt, worldUpdatedAt]);
}
