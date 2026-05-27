"use client";

/**
 * useMapDataBatched - Batched map data hook with two-phase loading.
 *
 * Phase 1 (fast): Loads critical layers (background, political, country_labels)
 *   + overlay features + capitals. The map renders immediately with borders.
 *
 * Phase 2 (deferred): Loads decorative layers (altitudes, rivers, lakes, icecaps)
 *   in a separate request. These fill in after the map is already visible.
 *
 * Maintains the same IndexedDB + React Query two-tier cache strategy.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { LAYER_CONFIGS, MAP_LAYER_TYPES, type MapLayerType } from "~/lib/map-config";
import type {
  MapLayerData,
  MapOverlayFeatures,
  CapitalsGeoJson,
} from "~/components/maps/core/IxWorldMap";
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

/** Critical layers load first — altitudes are the terrain base, must render with map */
const CRITICAL_LAYERS: MapLayerType[] = ["background", "altitudes", "political", "country_labels"];

/** Decorative layers load in a deferred second request */
const DECORATIVE_LAYERS: MapLayerType[] = ["rivers", "lakes", "icecaps"];

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

  const zoomParam = useMemo(
    () =>
      zoomBucket !== undefined ? (zoomBucket === 0 ? 2 : zoomBucket === 1 ? 5 : 8) : undefined,
    [zoomBucket]
  );

  // Determine which extra layers to include (e.g. user toggled climate on)
  const extraDecorativeLayers = useMemo(() => {
    const extra: MapLayerType[] = [];
    for (const layer of visibleLayers) {
      if (!CRITICAL_LAYERS.includes(layer) && !DECORATIVE_LAYERS.includes(layer)) {
        extra.push(layer);
      }
    }
    return extra;
  }, [visibleLayers]);

  // ── Phase 1: Critical layers + overlays + capitals (fast) ──
  const {
    data: criticalBundle,
    isLoading: criticalLoading,
    error: criticalError,
  } = api.geoCore.getMapBundle.useQuery(
    { layers: CRITICAL_LAYERS, zoom: zoomParam },
    {
      ...MAP_QUERY_OPTIONS,
      placeholderData: idbData
        ? ({ worldMap: idbData, features: undefined, capitals: undefined } as any)
        : undefined,
    }
  );

  // ── Phase 2: Decorative layers (deferred) ──
  const decorativeLayersToFetch = useMemo(
    () => [...DECORATIVE_LAYERS, ...extraDecorativeLayers],
    [extraDecorativeLayers]
  );

  const { data: decorativeData, isLoading: _decorativeLoading } = api.geoCore.getWorldMap.useQuery(
    { layers: decorativeLayersToFetch, zoom: zoomParam },
    {
      ...MAP_QUERY_OPTIONS,
      // Don't block the map from rendering — load in background
      placeholderData: undefined,
    }
  );

  // Merge both phases into a single world map record
  const mergedWorldMap = useMemo(() => {
    const merged: Record<string, unknown> = {};

    // Start with IDB cache as base (if available)
    if (idbData) Object.assign(merged, idbData);

    // Overlay critical layers
    if (criticalBundle?.worldMap) Object.assign(merged, criticalBundle.worldMap);

    // Overlay decorative layers when ready
    if (decorativeData) Object.assign(merged, decorativeData);

    return Object.keys(merged).length > 0 ? merged : null;
  }, [idbData, criticalBundle?.worldMap, decorativeData]);

  // Persist to IndexedDB when both phases are loaded
  const persistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mergedWorldMap) return;
    const keys = Object.keys(mergedWorldMap).sort().join(",");
    if (persistedRef.current === keys) return;
    persistedRef.current = keys;
    setCachedMapLayers(mergedWorldMap);
  }, [mergedWorldMap]);

  const isLoading = criticalLoading && !mergedWorldMap;

  const mapLayers: MapLayerData[] = useMemo(() => {
    if (!mergedWorldMap) return [];
    return Object.entries(mergedWorldMap)
      .filter(
        ([type]) =>
          MAP_LAYER_TYPES.includes(type as MapLayerType) && LAYER_CONFIGS[type as MapLayerType]
      )
      .map(([type, data]) => ({
        type: type as MapLayerType,
        data: data as FeatureCollection,
        visible: visibleLayers.has(type as MapLayerType),
      }))
      .sort((a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0));
  }, [mergedWorldMap, visibleLayers]);

  // Extract overlay features
  const overlayFeatures: MapOverlayFeatures | undefined = useMemo(() => {
    if (!criticalBundle?.features) return undefined;
    return criticalBundle.features as unknown as MapOverlayFeatures;
  }, [criticalBundle?.features]);

  // Extract capitals
  const capitalsGeoJson: CapitalsGeoJson | undefined = useMemo(() => {
    if (!criticalBundle?.capitals) return undefined;
    return criticalBundle.capitals as unknown as CapitalsGeoJson;
  }, [criticalBundle?.capitals]);

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
    error: criticalError,
    overlayFeatures,
    capitalsGeoJson,
  };
}
