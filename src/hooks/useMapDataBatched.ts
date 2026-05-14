"use client";

/**
 * useMapDataBatched - Batched map data hook that fetches world map layers,
 * overlay features, and capital cities in a single tRPC request.
 *
 * Replaces 3 separate queries (getWorldMap + getAllMapFeatures + getCapitalCities)
 * with a single getMapBundle call, reducing HTTP round-trips on initial map load.
 *
 * Maintains the same two-tier cache strategy as useMapData:
 * 1. IndexedDB (persistent) — survives page refreshes, 24h TTL
 * 2. React Query (in-memory) — instant during SPA navigation
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import {
  LAYER_CONFIGS,
  MAP_LAYER_TYPES,
  type MapLayerType,
} from "~/lib/map-config";
import type { MapLayerData, MapOverlayFeatures, CapitalsGeoJson } from "~/components/maps/core/IxWorldMap";
import type { FeatureCollection } from "geojson";
import { getCachedMapLayers, setCachedMapLayers } from "~/lib/map-idb-cache";
import { LOCKED_LAYERS, MAP_QUERY_OPTIONS } from "./useMapData";

const DEFAULT_VISIBLE: MapLayerType[] = [
  "background",
  "altitudes",
  "political",
  "rivers",
  "lakes",
  "country_labels",
];

// Climate is NOT prefetched — lazy-loaded when user toggles the layer.
// This cuts ~2MB from the initial bundle (climate = 2.12MB uncompressed).
const ALL_PREFETCH_LAYERS: MapLayerType[] = [
  ...DEFAULT_VISIBLE,
];

export function useMapDataBatched(initialLayers?: MapLayerType[], zoom?: number) {
  const [visibleLayers, setVisibleLayers] = useState<Set<MapLayerType>>(
    () => new Set(initialLayers ?? DEFAULT_VISIBLE)
  );

  // IndexedDB cached data (loaded once on mount)
  const [idbData, setIdbData] = useState<Record<string, unknown> | null>(null);
  const idbLoadedRef = useRef(false);

  useEffect(() => {
    if (idbLoadedRef.current) return;
    idbLoadedRef.current = true;
    getCachedMapLayers().then((cached) => {
      if (cached) setIdbData(cached);
    });
  }, []);

  // Compute zoom bucket — only re-fetches on bucket change
  const zoomBucket = useMemo(() => {
    if (zoom === undefined) return undefined;
    if (zoom < 4) return 0;
    if (zoom < 7) return 1;
    return 2;
  }, [zoom]);

  const allRequestedLayers = useMemo(() => {
    const layers = new Set([...ALL_PREFETCH_LAYERS, ...visibleLayers]);
    return Array.from(layers);
  }, [visibleLayers]);

  // Single batched query for all map data
  const {
    data: bundleData,
    isLoading: queryLoading,
    error,
  } = api.geo.getMapBundle.useQuery(
    {
      layers: allRequestedLayers,
      zoom: zoomBucket !== undefined ? (zoomBucket === 0 ? 2 : zoomBucket === 1 ? 5 : 8) : undefined,
    },
    {
      ...MAP_QUERY_OPTIONS,
      placeholderData: idbData ? { worldMap: idbData, features: undefined, capitals: undefined } as any : undefined,
    },
  );

  // Persist world map layers to IndexedDB
  const persistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bundleData?.worldMap) return;
    const keys = Object.keys(bundleData.worldMap).sort().join(",");
    if (persistedRef.current === keys) return;
    persistedRef.current = keys;
    setCachedMapLayers(bundleData.worldMap as Record<string, unknown>);
  }, [bundleData?.worldMap]);

  // Extract world map data
  const effectiveWorldMap = bundleData?.worldMap ?? idbData;
  const isLoading = queryLoading && !effectiveWorldMap;

  const mapLayers: MapLayerData[] = useMemo(() => {
    if (!effectiveWorldMap) return [];
    return Object.entries(effectiveWorldMap)
      .filter(
        ([type]) =>
          MAP_LAYER_TYPES.includes(type as MapLayerType) &&
          LAYER_CONFIGS[type as MapLayerType]
      )
      .map(([type, data]) => ({
        type: type as MapLayerType,
        data: data as FeatureCollection,
        visible: visibleLayers.has(type as MapLayerType),
      }))
      .sort(
        (a, b) =>
          (LAYER_CONFIGS[a.type]?.zIndex ?? 0) -
          (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
      );
  }, [effectiveWorldMap, visibleLayers]);

  // Extract overlay features
  const overlayFeatures: MapOverlayFeatures | undefined = useMemo(() => {
    if (!bundleData?.features) return undefined;
    return bundleData.features as unknown as MapOverlayFeatures;
  }, [bundleData?.features]);

  // Extract capitals
  const capitalsGeoJson: CapitalsGeoJson | undefined = useMemo(() => {
    if (!bundleData?.capitals) return undefined;
    return bundleData.capitals as unknown as CapitalsGeoJson;
  }, [bundleData?.capitals]);

  const toggleLayer = useCallback((layer: MapLayerType) => {
    if (LOCKED_LAYERS.includes(layer)) return;
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  return {
    mapLayers,
    visibleLayers,
    toggleLayer,
    isLoading,
    error,
    overlayFeatures,
    capitalsGeoJson,
  };
}
