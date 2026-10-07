"use client";

/**
 * useMapDataBatched - /maps data: one bundle and the per-layer extras.
 *
 * Bundle: the GeoJSON layers (CRITICAL_LAYERS: background, political, labels, icecaps) + POIs and
 *   capitals, in one request. Cities and subdivisions follow once the viewer passes zoom 3.
 *
 * Altitudes, rivers and lakes are vector tiles (`~/lib/maps/decorative-tiles`); they are
 *   listed here with no data so their visibility toggles work. Other layers the user switches on
 *   load one request per layer.
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
import { unpackLayers } from "~/lib/maps/geojson-pack";
import { TILED_LAYERS, isTiledLayer } from "~/lib/maps/decorative-tiles";
import { CRITICAL_LAYERS, LOCKED_LAYERS, MAP_QUERY_OPTIONS, mergeLayerResults } from "./useMapData";

const DEFAULT_VISIBLE: MapLayerType[] = [
  "background",
  "altitudes",
  "political",
  "rivers",
  "lakes",
  "country_labels",
];

const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Zoom at which cities and subdivisions (drawn from zoom 4) start loading. */
export const DETAIL_FETCH_ZOOM = 3;

/** Server LOD bucket for a zoom level (mirrors `getZoomBucket` in geo/core/cache.ts). */
function getMapZoomBucket(zoom: number | undefined): 0 | 1 | 2 | undefined {
  if (zoom === undefined) return undefined;
  if (zoom < 4) return 0;
  if (zoom < 7) return 1;
  return 2;
}

/** The zoom range data loading cares about: below the zoom-3 detail fetch, up to the zoom-4 overlays,
 * up to the zoom-7 detail bucket, beyond. The map only reports zoom when this changes. */
export function getZoomBand(zoom: number): number {
  return [DETAIL_FETCH_ZOOM, 4, 7].filter((edge) => zoom >= edge).length;
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
        !isTiledLayer(layer) &&
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

  // Cities and subdivisions draw from zoom 4: fetch them once the viewer first passes zoom 3, so
  // they are there in time and the globe view never downloads them. Latched: zooming back out
  // keeps them.
  const [wantDetail, setWantDetail] = useState(false);
  useEffect(() => {
    if ((zoom ?? 0) >= DETAIL_FETCH_ZOOM) setWantDetail(true);
  }, [zoom]);
  const { data: detail } = api.geoCore.getMapBundleDetail.useQuery(
    { realm },
    { ...MAP_QUERY_OPTIONS, enabled: wantDetail }
  );

  // Extra GeoJSON layers switched on this session, one query per layer so turning on a second
  // one fetches only that layer. Tiled layers (altitudes, rivers, lakes) never come here.
  const decorativeData = api.useQueries(
    (t) =>
      requestedExtraLayers.map((layer) =>
        t.geoCore.getWorldMapPacked({ layers: [layer], realm }, { ...MAP_QUERY_OPTIONS })
      ),
    { combine: mergeLayerResults }
  );

  // Both phases arrive packed (the IndexedDB placeholder is already plain GeoJSON)
  const bundleLayers = useMemo(
    () => (criticalBundle?.worldMap ? unpackLayers(criticalBundle.worldMap) : undefined),
    [criticalBundle?.worldMap]
  );
  const decorativeLayers = useMemo(
    () => (decorativeData ? unpackLayers(decorativeData) : undefined),
    [decorativeData]
  );

  // Merge both phases into a single world map record
  const mergedWorldMap = useMemo(() => {
    const merged: Record<string, unknown> = {};

    // Start with IDB cache as base (if available)
    if (idbData) Object.assign(merged, idbData);

    // Overlay critical layers
    if (bundleLayers) Object.assign(merged, bundleLayers);

    // Overlay decorative layers when ready
    if (decorativeLayers) Object.assign(merged, decorativeLayers);

    // Tiled layers draw from vector tiles: listed (for visibility) with no data, even when an
    // older cache entry still carries them
    for (const type of TILED_LAYERS) merged[type] = EMPTY_COLLECTION;

    return bundleLayers || idbData || decorativeLayers ? merged : null;
  }, [idbData, bundleLayers, decorativeLayers]);

  // Persist the server's layers (never the cache-backed placeholder) under the realm it resolved
  const persistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!criticalBundle?.realmId || criticalIsPlaceholder) return;
    const fresh: Record<string, unknown> = { ...bundleLayers, ...decorativeLayers };
    const keys = Object.keys(fresh).sort().join(",");
    const marker = `${mapLayersCacheKey(cacheScope)}|${criticalBundle.realmId}|${keys}`;
    if (persistedRef.current === marker) return;
    persistedRef.current = marker;
    void setCachedMapLayers(cacheScope, fresh, criticalBundle.realmId);
  }, [criticalBundle, criticalIsPlaceholder, bundleLayers, decorativeLayers, cacheScope]);

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

  // Overlay features: POIs from the bundle, cities and subdivisions once the detail arrives
  const overlayFeatures: MapOverlayFeatures | undefined = useMemo(() => {
    if (!criticalBundle?.features) return undefined;
    return {
      pois: criticalBundle.features.pois,
      cities: detail?.cities ?? EMPTY_COLLECTION,
      subdivisions: detail ? unpackLayers({ s: detail.subdivisions }).s! : EMPTY_COLLECTION,
    } as unknown as MapOverlayFeatures;
  }, [criticalBundle?.features, detail]);

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
    /** The realm these layers are for (tile URLs use it): the server's answer once the bundle is in;
     * before that, without ?realm=, the viewer's realm, which is what the server resolves then too */
    realmId:
      (criticalIsPlaceholder ? undefined : criticalBundle?.realmId) ??
      (realm ? undefined : viewerRealmId),
    overlayFeatures,
    capitalsGeoJson,
  };
}
