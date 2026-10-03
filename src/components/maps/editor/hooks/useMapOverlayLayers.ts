import { useEffect, useMemo } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, GeoJsonProperties, Polygon, MultiPolygon } from "geojson";
import {
  EMPTY_FC,
  collection,
  haversineDistance,
  lineFeature,
  midpointFeatures,
  pointFeature,
  upsertGeoJSONLayers,
} from "../utils/map-helpers";
import {
  EMPTY_REGION_LAYERS,
  GAP_LAYERS,
  LASSO_LAYERS,
  PENDING_POINT_LAYERS,
  ROUTE_LINE_LAYERS,
  ROUTE_MIDPOINT_LAYERS,
  ROUTE_POINT_LAYERS,
  RULER_LAYERS,
  interactionSources,
} from "../utils/editor-layer-specs";
import type { MapTheme } from "~/lib/map-styles/registry";

interface UseMapOverlayLayersProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  theme?: MapTheme;
  pendingCoordinates: [number, number] | null;
  routeWaypoints?: [number, number][];
  gapFeatures?: FeatureCollection | null;
  showGaps?: boolean;
  emptyRegionsFeatures?: FeatureCollection | null;
  showEmptyRegions?: boolean;
  lassoGeometry?: Polygon | MultiPolygon | null;
  rulerPoints?: [number, number][];
}

/** One point per segment midpoint, carrying the segment's haversine length ("12.3 km"). */
const segmentLabels = (
  points: [number, number][],
  toProperties: (label: string) => GeoJsonProperties
) =>
  midpointFeatures(points, (_, a, b) => toProperties(`${haversineDistance(a, b).toFixed(1)} km`));

/** Transient editor overlays: pending marker, route/ruler drafts, gap/empty/lasso highlights. */
export function useMapOverlayLayers({
  map,
  isLoaded,
  theme,
  pendingCoordinates,
  routeWaypoints,
  gapFeatures,
  showGaps,
  emptyRegionsFeatures,
  showEmptyRegions,
  lassoGeometry,
  rulerPoints,
}: UseMapOverlayLayersProps) {
  useEffect(() => {
    if (!map || !isLoaded) return;
    const data = pendingCoordinates ? collection([pointFeature(pendingCoordinates)]) : EMPTY_FC;
    upsertGeoJSONLayers(map, "editor-pending-point", data, PENDING_POINT_LAYERS);
    // oxlint-disable-next-line
  }, [map, isLoaded, pendingCoordinates, theme]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const waypoints = routeWaypoints ?? [];
    upsertGeoJSONLayers(
      map,
      "editor-route-line",
      collection(waypoints.length >= 2 ? [lineFeature(waypoints)] : []),
      ROUTE_LINE_LAYERS
    );
    upsertGeoJSONLayers(
      map,
      "editor-route-points",
      collection(waypoints.map((wp) => pointFeature(wp))),
      ROUTE_POINT_LAYERS
    );
    upsertGeoJSONLayers(
      map,
      "editor-route-midpoint-labels",
      collection(segmentLabels(waypoints, (label) => ({ label }))),
      ROUTE_MIDPOINT_LAYERS
    );
    // oxlint-disable-next-line
  }, [map, isLoaded, routeWaypoints, theme]);

  // Empty sources for drawing, vertex editing and route editing; the edit hooks fill them.
  useEffect(() => {
    if (!map || !isLoaded) return;
    for (const [sourceId, layers] of interactionSources()) {
      if (!map.getSource(sourceId)) upsertGeoJSONLayers(map, sourceId, EMPTY_FC, layers);
    }
    // oxlint-disable-next-line
  }, [map, isLoaded, theme]);

  const gaps = gapFeatures && showGaps ? gapFeatures : EMPTY_FC;
  useEffect(() => {
    if (!map || !isLoaded) return;
    upsertGeoJSONLayers(map, "editor-gaps", gaps, GAP_LAYERS);
  }, [map, isLoaded, gaps]);

  const emptyRegions = emptyRegionsFeatures && showEmptyRegions ? emptyRegionsFeatures : EMPTY_FC;
  useEffect(() => {
    if (!map || !isLoaded) return;
    upsertGeoJSONLayers(map, "editor-empty-subdivisions", emptyRegions, EMPTY_REGION_LAYERS);
  }, [map, isLoaded, emptyRegions]);

  const lasso = useMemo<Feature | FeatureCollection>(
    () => (lassoGeometry ? { type: "Feature", geometry: lassoGeometry, properties: {} } : EMPTY_FC),
    [lassoGeometry]
  );
  useEffect(() => {
    if (!map || !isLoaded) return;
    upsertGeoJSONLayers(map, "editor-lasso", lasso, LASSO_LAYERS);
  }, [map, isLoaded, lasso]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const points = rulerPoints ?? [];
    upsertGeoJSONLayers(
      map,
      "editor-ruler",
      collection([
        ...points.map((pt, index) => pointFeature(pt, { index: index.toString(), type: "point" })),
        ...(points.length > 1 ? [lineFeature(points, { type: "line" })] : []),
        ...segmentLabels(points, (distance) => ({ type: "label", distance })),
      ]),
      RULER_LAYERS
    );
  }, [map, isLoaded, rulerPoints]);
}
