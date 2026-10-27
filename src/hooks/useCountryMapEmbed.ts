"use client";

/**
 * useCountryMapEmbed - Data hook for country-focused map embeds.
 *
 * Fetches a single country's geometry, neighbors, cities, and POIs
 * via a single unified countryGeo.getCountryGeoBundle tRPC endpoint (30min stale, 2hr gc).
 * The neighbours come from the political layer /maps downloads: the same versioned layer URL, so the browser's
 * copy serves both.
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useDecodedMapLayers } from "~/hooks/useMapLayerData";

/** The subdivision fields the embed maps draw. */
interface EmbedSubdivision {
  id: string;
  name: string;
  geometry: GeoJSON.Geometry | null;
}

const MAP_CACHE = { staleTime: 30 * 60_000, gcTime: 2 * 60 * 60_000 } as const;

export function useCountryMapEmbed(countryId: string | null | undefined) {
  const enabled = !!countryId;

  // Fetch the unified geographic bundle (contains geometry, neighbors, cities, POIs, subdivisions)
  const { data: bundle, isLoading: bundleLoading } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: countryId! },
    { enabled, ...MAP_CACHE }
  );

  // World political layer for neighbor rendering: the packed layer /maps downloads (same versioned URL), of the
  // country's realm, which is not the viewer's when the country is another realm's. It waits for the bundle, which
  // names that realm (a bundle that does not leaves the viewer's realm).
  const { layers: worldMap } = useDecodedMapLayers({
    layers: ["political"],
    realm: bundle?.country?.realmSlug ?? undefined,
    enabled: enabled && !!bundle,
  });

  return useMemo(() => {
    const cities = bundle?.cities ?? [];
    const capital = (cities as any[]).find((c: any) => c.isNationalCapital) ?? null;
    const rawBBox = bundle?.boundingBox as number[] | null;
    const bbox =
      rawBBox && rawBBox.length === 4
        ? { minLng: rawBBox[0], minLat: rawBBox[1], maxLng: rawBBox[2], maxLat: rawBBox[3] }
        : null;

    // Derived neighbor feature collection for greyed-out neighbor rendering
    const worldPolitical =
      worldMap?.political ??
      (bundle?.neighbors?.length
        ? ({
            type: "FeatureCollection",
            features: bundle.neighbors,
          } as unknown as import("geojson").FeatureCollection)
        : undefined);

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
      subdivisions: (bundle?.subdivisions ?? []) as EmbedSubdivision[],

      // Neighbors
      neighbors: bundle?.neighbors ?? [],

      // World political layer for greyed-out neighbor rendering
      worldPolitical,

      // State
      isLoading: bundleLoading,
      hasGeometry: !!bundle?.geometry,
    };
  }, [bundle, worldMap, bundleLoading]);
}
