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
 * Maintains the same IndexedDB + React Query two-tier cache strategy. The IndexedDB entry is the
 * shown realm's: written only from a real (non-placeholder) bundle, tagged with the realm it resolved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { LAYER_CONFIGS, MAP_LAYER_TYPES, type MapLayerType } from "~/lib/maps/map-config";
import type {
  MapLayerData,
  MapOverlayFeatures,
  CapitalsGeoJson,
} from "~/components/maps/core/IxWorldMap";
import type { FeatureCollection } from "geojson";
import {
  getCachedMapLayers,
  mapLayersCacheKey,
  setCachedMapLayers,
  type MapCacheScope,
} from "~/lib/maps/map-idb-cache";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { CRITICAL_LAYERS, LOCKED_LAYERS, MAP_QUERY_OPTIONS } from "./useMapData";

const DEFAULT_VISIBLE: MapLayerType[] = [
  "background",
  "altitudes",
  "political",
  "rivers",
  "lakes",
  "country_labels",
];

/** Decorative layers load in a deferred second request */
const DECORATIVE_LAYERS: MapLayerType[] = [];

/** Merge per-layer `getWorldMap` results into one record (undefined until any arrives). */
function mergeLayerResults(
  results: ReadonlyArray<{ data?: unknown }>
): Record<string, unknown> | undefined {
  let merged: Record<string, unknown> | undefined;
  for (const r of results) {
    if (r.data) merged = { ...merged, ...(r.data as Record<string, unknown>) };
  }
  return merged;
}

/** Server LOD bucket for a zoom level (mirrors `getZoomBucket` in geo/core/cache.ts). */
export function getMapZoomBucket(zoom: number | undefined): 0 | 1 | 2 | undefined {
  if (zoom === undefined) return undefined;
  if (zoom < 4) return 0;
  if (zoom < 7) return 1;
  return 2;
}

/** @param realm realm slug the map shows (`?realm=`); undefined = the viewer's realm */
export function useMapDataBatched(initialLayers?: MapLayerType[], zoom?: number, realm?: string) {
  const [visibleLayers, setVisibleLayers] = useState<Set<MapLayerType>>(
    () => new Set(initialLayers ?? DEFAULT_VISIBLE)
  );

  // IndexedDB cached data for the realm this map shows — only once that realm is known
  const viewerRealmId = useViewerRealmId();
  const cacheScope = useMemo<MapCacheScope>(
    () => ({ realm, viewerRealmId }),
    [realm, viewerRealmId]
  );
  const [idbData, setIdbData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIdbData(null);
    getCachedMapLayers(cacheScope).then((cached) => {
      if (cached && !cancelled) setIdbData(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [cacheScope]);

  // Level of detail. The first bundle is requested without a zoom (the server's mid-zoom LOD,
  // the same key MapPrefetcher warms), which is already the most detail the viewer can show
  // below zoom 7. Requesting a coarser globe bundle after the first zoom, then the mid bundle
  // again past zoom 4, re-downloaded and re-tiled every layer mid-gesture for no visual gain,
  // so only the detail bucket (zoom >= 7, when the max zoom allows it) gets its own request.
  const zoomParam = getMapZoomBucket(zoom) === 2 ? 8 : undefined;

  // Extra (non-critical) layers the user has switched on this session, e.g. climate. The set
  // only grows: switching a layer off hides it on the map but keeps its data, so switching it
  // back on is instant and never re-sends the GeoJSON to the map worker.
  const [requestedExtraLayers, setRequestedExtraLayers] = useState<MapLayerType[]>([]);
  useEffect(() => {
    const missing = [...visibleLayers].filter(
      (layer) =>
        !CRITICAL_LAYERS.includes(layer) &&
        !DECORATIVE_LAYERS.includes(layer) &&
        !requestedExtraLayers.includes(layer)
    );
    if (missing.length > 0) setRequestedExtraLayers((prev) => [...prev, ...missing]);
  }, [visibleLayers, requestedExtraLayers]);

  // Phase 1: Critical layers + overlays + capitals (fast)
  const {
    data: criticalBundle,
    isLoading: criticalLoading,
    error: criticalError,
    isPlaceholderData: criticalIsPlaceholder,
  } = api.geoCore.getMapBundle.useQuery(
    { layers: CRITICAL_LAYERS, zoom: zoomParam, realm },
    {
      ...MAP_QUERY_OPTIONS,
      placeholderData: (prev) =>
        prev ||
        (idbData
          ? ({ worldMap: idbData, features: undefined, capitals: undefined } as any)
          : undefined),
    }
  );

  // Phase 2: Decorative / extra layers (deferred, one request per layer)
  // One query per layer so turning on a second extra layer fetches only that layer instead of
  // re-downloading the first one under a new combined cache key. No zoom in the key, so
  // zooming never re-fetches them.
  const decorativeLayersToFetch = useMemo(
    () => [...DECORATIVE_LAYERS, ...requestedExtraLayers],
    [requestedExtraLayers]
  );

  const decorativeData = api.useQueries(
    (t) =>
      decorativeLayersToFetch.map((layer) =>
        t.geoCore.getWorldMap({ layers: [layer], realm }, { ...MAP_QUERY_OPTIONS })
      ),
    { combine: mergeLayerResults }
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

  // Persist the server's layers (never the cache-backed placeholder) under the realm it resolved
  const persistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!criticalBundle?.realmId || criticalIsPlaceholder) return;
    const fresh: Record<string, unknown> = { ...criticalBundle.worldMap, ...decorativeData };
    const keys = Object.keys(fresh).sort().join(",");
    const marker = `${mapLayersCacheKey(cacheScope)}|${criticalBundle.realmId}|${keys}`;
    if (persistedRef.current === marker) return;
    persistedRef.current = marker;
    void setCachedMapLayers(cacheScope, fresh, criticalBundle.realmId);
  }, [criticalBundle, criticalIsPlaceholder, decorativeData, cacheScope]);

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
