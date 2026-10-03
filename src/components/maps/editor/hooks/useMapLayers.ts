import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon, Position, FeatureCollection, Geometry } from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import {
  EMPTY_FC,
  buildPointFeatures,
  collection,
  lineFeature,
  setLayerOpacity,
  upsertGeoJSONLayers,
} from "../utils/map-helpers";
import { geoJSONPatcher } from "../utils/geoJsonPatcher";
import {
  COUNTRY_BOUNDARY_LAYERS,
  COUNTRY_MASK_LAYERS,
  GRID_LABEL_ID,
  GRID_LAYERS,
  GRID_LAYER_ID,
  POINT_GHOST_LAYERS,
  POINT_LAYERS,
  RIVER_LINE_LAYERS,
  subdivisionLayers,
} from "../utils/editor-layer-specs";
import { useMapOverlayLayers } from "./useMapOverlayLayers";
import { useWorldContextLayers } from "./useWorldContextLayers";
import type { MapTheme } from "~/lib/map-styles/registry";

interface UseMapLayersProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  countryGeometry: object | null;
  countryBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  countryColor?: string;
  features: EditorFeature[];
  layerVisibility?: Record<string, boolean>;
  layerOpacity?: Record<string, number>;
  pendingCoordinates: [number, number] | null;
  worldMapLayers?: MapLayerData[];
  showGrid?: boolean;
  gridZoomBucket: number;
  routeWaypoints?: [number, number][];
  theme?: MapTheme;
  gapFeatures?: FeatureCollection | null;
  showGaps?: boolean;
  emptyRegionsFeatures?: FeatureCollection | null;
  showEmptyRegions?: boolean;
  lassoGeometry?: Polygon | MultiPolygon | null;
  rulerPoints?: [number, number][];
}

/** Layers-panel toggle that hides each feature type ("route" is drawn by TransportOverlay). */
const VISIBILITY_TOGGLE: Partial<Record<string, string>> = {
  city: "cities",
  poi: "pois",
  storyPin: "stories",
  mapLabel: "labels",
  subdivision: "regions",
  peak: "geography",
  river: "geography",
  lake: "geography",
};

/** [layer, paint property, opacity key, scale]; the effective opacity is scale * layerOpacity[key]. */
const OPACITY_BINDINGS = [
  ["editor-subdivisions-stroke", "line-opacity", "regions", 1],
  ["editor-subdivisions-fill", "fill-opacity", "regions", 0.05],
  ["editor-subdivisions-labels", "text-opacity", "regions", 1],
  ["editor-points-capital", "circle-opacity", "cities", 1],
  ["editor-points-city", "circle-opacity", "cities", 1],
  ["editor-points-poi", "circle-opacity", "pois", 1],
  ["editor-points-story-pin", "circle-opacity", "stories", 1],
  ["editor-map-labels", "text-opacity", "labels", 1],
  ["editor-lines", "line-opacity", "geography", 0.9],
  ["editor-points-peak", "circle-opacity", "geography", 1],
] as const;
const DEFAULT_OPACITY: Partial<Record<string, number>> = { regions: 0.6 };

const BORDER_LAYER_IDS = [
  "editor-country-fill",
  "editor-country-stroke",
  "editor-nonplayer-mask-fill",
];

const polygonal = (g: unknown) => /^(Multi)?Polygon$/.test((g as { type?: string })?.type ?? "");
const linear = (g: unknown) => /^(Multi)?LineString$/.test((g as { type?: string })?.type ?? "");

/** Stable string for a record so a fresh-but-equal object does not re-run the effects. */
const recordKey = <V>(record: Record<string, V> | undefined, format: (v: V) => string) =>
  record
    ? Object.keys(record)
        .sort()
        .map((k) => `${k}:${format(record[k] as V)}`)
        .join("|")
    : "";

function setLayersVisibility(map: MapLibreMap, ids: string[], visibility: "visible" | "none") {
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
  }
}

/** Inverse mask: the world rectangle with the country outline(s) cut out as holes. */
function nonPlayerMask(countryGeometry: Polygon | MultiPolygon) {
  const worldOuter: Position[] = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
  ];
  const outerRings =
    countryGeometry.type === "Polygon"
      ? [countryGeometry.coordinates[0] as Position[]]
      : (countryGeometry.coordinates as Position[][][]).map((poly) => poly[0] as Position[]);
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [worldOuter, ...outerRings] },
    properties: {},
  };
}

function buildGridLines(bbox: UseMapLayersProps["countryBbox"], zoomBucket: number) {
  const margin = 5;
  const minLng = bbox ? Math.floor((bbox.minLng - margin) / 5) * 5 : -180;
  const maxLng = bbox ? Math.ceil((bbox.maxLng + margin) / 5) * 5 : 180;
  const minLat = bbox ? Math.max(-85, Math.floor((bbox.minLat - margin) / 5) * 5) : -85;
  const maxLat = bbox ? Math.min(85, Math.ceil((bbox.maxLat + margin) / 5) * 5) : 85;
  const spacing = [10, 5, 1, 0.5][zoomBucket] ?? 5;

  const lines = [];
  for (let lng = minLng; lng <= maxLng; lng += spacing) {
    lines.push(
      lineFeature(
        [
          [lng, minLat],
          [lng, maxLat],
        ],
        { label: `${Math.abs(lng)}°${lng >= 0 ? "E" : "W"}` }
      )
    );
  }
  for (let lat = minLat; lat <= maxLat; lat += spacing) {
    lines.push(
      lineFeature(
        [
          [minLng, lat],
          [maxLng, lat],
        ],
        { label: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}` }
      )
    );
  }
  return lines;
}

export function useMapLayers({
  map,
  isLoaded,
  countryGeometry,
  countryBbox,
  countryColor,
  features,
  layerVisibility,
  layerOpacity,
  pendingCoordinates,
  worldMapLayers,
  showGrid,
  gridZoomBucket,
  routeWaypoints,
  theme,
  gapFeatures,
  showGaps,
  emptyRegionsFeatures,
  showEmptyRegions,
  lassoGeometry,
  rulerPoints,
}: UseMapLayersProps) {
  const layerVisibilityRef = useRef(layerVisibility);
  // oxlint-disable-next-line -- latest-value ref read inside the keyed effects
  layerVisibilityRef.current = layerVisibility;
  const layerOpacityRef = useRef(layerOpacity);
  // oxlint-disable-next-line -- latest-value ref read inside the keyed effects
  layerOpacityRef.current = layerOpacity;
  // Value keys so a parent passing a fresh-but-equal object does not re-upload geometry.
  const visibilityKey = recordKey(layerVisibility, (v) => (v ? "1" : "0"));
  const opacityKey = recordKey(layerOpacity, String);

  useWorldContextLayers(map, isLoaded, worldMapLayers, theme);

  // Country boundary and the dimmed non-player mask around it.
  useEffect(() => {
    if (!map || !isLoaded || !countryGeometry) return;
    const sourceId = "editor-country-boundary";
    const isFirstAdd = !map.getSource(sourceId);
    upsertGeoJSONLayers(
      map,
      sourceId,
      collection([{ type: "Feature", geometry: countryGeometry as Geometry, properties: {} }]),
      COUNTRY_BOUNDARY_LAYERS
    );
    if (isFirstAdd && !map.getSource("editor-nonplayer-mask")) {
      upsertGeoJSONLayers(
        map,
        "editor-nonplayer-mask",
        nonPlayerMask(countryGeometry as Polygon | MultiPolygon),
        COUNTRY_MASK_LAYERS
      );
    }
    // oxlint-disable-next-line
  }, [map, isLoaded, countryGeometry, countryColor, theme]);

  // Layers panel "Country Border" eye toggle.
  useEffect(() => {
    if (!map || !isLoaded) return;
    const hidden = layerVisibilityRef.current?.border === false;
    setLayersVisibility(map, BORDER_LAYER_IDS, hidden ? "none" : "visible");
    // oxlint-disable-next-line
  }, [map, isLoaded, visibilityKey, countryGeometry, theme]);

  // Coordinate grid overlay.
  useEffect(() => {
    if (!map || !isLoaded) return;
    const gridLayerIds = [GRID_LAYER_ID, GRID_LABEL_ID];
    if (!showGrid) {
      setLayersVisibility(map, gridLayerIds, "none");
      return;
    }
    upsertGeoJSONLayers(
      map,
      "editor-grid",
      collection(buildGridLines(countryBbox, gridZoomBucket)),
      GRID_LAYERS
    );
    setLayersVisibility(map, gridLayerIds, "visible");
    // oxlint-disable-next-line
  }, [map, isLoaded, showGrid, gridZoomBucket, countryBbox, theme]);

  // Existing features (subdivisions, cities, POIs, story pins, map labels, rivers). Data upload
  // runs only when the features or the visibility *values* change.
  useEffect(() => {
    if (!map || !isLoaded) return;

    const toggles = layerVisibilityRef.current ?? {};
    const visibleFeatures = features.filter((f) => {
      const toggle = VISIBILITY_TOGGLE[f.type];
      return f.type !== "route" && !(toggle && toggles[toggle] === false);
    });

    const pointFeatures = buildPointFeatures(visibleFeatures);
    geoJSONPatcher.cacheSourceFeatures("editor-points", pointFeatures);
    if (!map.getSource("editor-points")) {
      upsertGeoJSONLayers(map, "editor-points-ghost", EMPTY_FC, POINT_GHOST_LAYERS);
    }
    upsertGeoJSONLayers(map, "editor-points", collection(pointFeatures), POINT_LAYERS);

    const lineFeatures = visibleFeatures
      .filter((f) => f.type === "river" && linear(f.geometry))
      .map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry as Geometry,
        properties: { id: f.id, name: f.name, featureType: f.type },
      }));
    upsertGeoJSONLayers(map, "editor-lines", collection(lineFeatures), RIVER_LINE_LAYERS);

    const polyFeatures = visibleFeatures
      .filter((f) => polygonal(f.geometry))
      .map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry as Geometry,
        properties: {
          id: f.id,
          name: f.name,
          color: f.type === "lake" ? "#38bdf8" : f.properties.color,
          featureType: f.type,
        },
      }));
    upsertGeoJSONLayers(
      map,
      "editor-subdivisions",
      collection(polyFeatures),
      subdivisionLayers(layerOpacity?.regions ?? 0.6)
    );
    // oxlint-disable-next-line
  }, [map, isLoaded, features, visibilityKey, theme]);

  // Layer opacity is a paint change only, no data re-upload.
  useEffect(() => {
    if (!map || !isLoaded) return;
    const opacity = layerOpacityRef.current ?? {};
    for (const [layerId, property, key, scale] of OPACITY_BINDINGS) {
      setLayerOpacity(map, layerId, property, scale * (opacity[key] ?? DEFAULT_OPACITY[key] ?? 1));
    }
    // oxlint-disable-next-line
  }, [map, isLoaded, opacityKey, theme, features]);

  useMapOverlayLayers({
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
  });
}
