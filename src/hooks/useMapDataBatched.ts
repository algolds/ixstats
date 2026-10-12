"use client";

/**
 * useMapDataBatched - /maps data: the GeoJSON layers, POIs and capitals, and the zoom-4 detail.
 *
 * Layers: the first-paint ones (CRITICAL_LAYERS: background, political, labels, icecaps) download as packed JSON from
 *   the versioned layer route (`useMapLayerData`), so a repeat load finds them in the browser cache. Cities and
 *   subdivisions follow once the viewer passes zoom 3.
 *
 * Altitudes, rivers and lakes are vector tiles (`~/lib/maps/decorative-tiles`); they are
 *   listed here with no data so their visibility toggles work. Other layers the user switches on
 *   load one request per layer.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import { LAYER_CONFIGS, MAP_LAYER_TYPES, type MapLayerType } from "~/lib/maps/map-config";
import type {
  MapLayerData,
  MapOverlayFeatures,
  CapitalsGeoJson,
} from "~/components/maps/core/IxWorldMap";
import type { FeatureCollection } from "geojson";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { useMapLayerData, type MapLayerBucket } from "~/hooks/useMapLayerData";
import { unpackLayers } from "~/lib/maps/geojson-pack";
import { TILED_LAYERS, isTiledLayer } from "~/lib/maps/decorative-tiles";
import { CRITICAL_LAYERS, LOCKED_LAYERS, MAP_QUERY_OPTIONS } from "./useMapData";

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

  const viewerRealmId = useViewerRealmId();

  // Level of detail. The first layers are the server's mid-zoom LOD, which is already the most
  // detail the viewer can show below zoom 7. Requesting a coarser globe bucket after the first
  // zoom, then the mid one again past zoom 4, re-downloaded and re-tiled every layer mid-gesture
  // for no visual gain, so only the detail bucket (zoom >= 7, when the max zoom allows it) gets
  // its own request.
  const bucket: MapLayerBucket = getMapZoomBucket(zoom) === 2 ? 2 : 1;

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

  // Phase 1: the first-paint layers, from the versioned layer route
  const critical = useMapLayerData({ layers: CRITICAL_LAYERS, realm, bucket });
  // Extra GeoJSON layers switched on this session, one request per layer so turning on a second
  // one fetches only that layer. Tiled layers (altitudes, rivers, lakes) never come here.
  const extra = useMapLayerData({ layers: requestedExtraLayers, realm, bucket: 1 });

  // POIs and capitals, which the layers do not carry
  const { data: markers } = api.geoCore.getMapBundleMarkers.useQuery({ realm }, MAP_QUERY_OPTIONS);

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

  // Both arrive packed
  const criticalLayers = useMemo(
    () => (critical.packed ? unpackLayers(critical.packed) : undefined),
    [critical.packed]
  );
  const extraLayers = useMemo(
    () => (extra.packed ? unpackLayers(extra.packed) : undefined),
    [extra.packed]
  );

  // Merge both phases into a single world map record
  const mergedWorldMap = useMemo(() => {
    if (!criticalLayers && !extraLayers) return null;
    const merged: Record<string, unknown> = { ...criticalLayers, ...extraLayers };

    // Tiled layers draw from vector tiles: listed (for visibility) with no data
    for (const type of TILED_LAYERS) merged[type] = EMPTY_COLLECTION;

    return merged;
  }, [criticalLayers, extraLayers]);

  const isLoading = critical.isPending && !mergedWorldMap;

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

  // Overlay features: POIs with the markers, cities and subdivisions once the detail arrives
  const overlayFeatures: MapOverlayFeatures | undefined = useMemo(() => {
    if (!markers?.features) return undefined;
    return {
      pois: markers.features.pois,
      cities: detail?.cities ?? EMPTY_COLLECTION,
      subdivisions: detail ? unpackLayers({ s: detail.subdivisions }).s! : EMPTY_COLLECTION,
    } as unknown as MapOverlayFeatures;
  }, [markers?.features, detail]);

  // Extract capitals
  const capitalsGeoJson: CapitalsGeoJson | undefined = useMemo(() => {
    if (!markers?.capitals) return undefined;
    return markers.capitals as unknown as CapitalsGeoJson;
  }, [markers?.capitals]);

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
    error: critical.error,
    /** The realm these layers are for (tile URLs use it): the map version's answer once it is in;
     * before that, without ?realm=, the viewer's realm, which is what the server resolves then too */
    realmId: critical.realmId ?? (realm ? undefined : viewerRealmId),
    overlayFeatures,
    capitalsGeoJson,
  };
}
