import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { LAYER_CONFIGS, MAP_LAYER_TYPES, type MapLayerType } from "~/lib/maps/map-config";
import { setLayerOpacity } from "../utils/map-helpers";
import type { MapTheme } from "~/lib/map-styles/registry";

type LayerConfig = (typeof LAYER_CONFIGS)[MapLayerType];

/** Context layers are inserted below the first of these editor layers that exists. */
const EDITOR_LAYER_IDS = [
  "neighbors-fill",
  "neighbors-line",
  "merge-targets-fill",
  "active-fill",
  "active-line",
  "editor-country-fill",
  "editor-country-stroke",
  "editor-nonplayer-mask-fill",
  "editor-subdivisions-fill",
  "editor-subdivisions-stroke",
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-story-pin",
  "editor-points-map-label",
  "editor-points-labels",
  "editor-pending-point-layer",
  "editor-route-line-layer",
  "editor-draw-polygon-fill",
  "editor-vedit-polygon-fill",
];

const RIVER_WIDTH = [
  "interpolate",
  ["exponential", 1.2],
  ["zoom"],
  0,
  0.4,
  2,
  0.6,
  4,
  1.0,
  6,
  1.8,
  9,
  3.2,
  12,
  6.0,
] as ExpressionSpecification;

const RIVER_OPACITY = [
  "interpolate",
  ["linear"],
  ["zoom"],
  0,
  0.25,
  2,
  0.35,
  4,
  0.55,
  6,
  0.75,
  8,
  0.9,
] as ExpressionSpecification;

function addContextLayer(
  map: MapLibreMap,
  layer: MapLayerData,
  config: LayerConfig,
  beforeId: string | undefined
) {
  const sourceId = `source-${layer.type}`;
  const fillLayerId = `fill-${layer.type}`;
  map.addSource(sourceId, {
    type: "geojson",
    data: layer.data as FeatureCollection,
    generateId: true,
    tolerance: 0,
    buffer: 256,
  });

  if (config.type === "line") {
    const isRiver = layer.type === "rivers";
    const strokeWidth = config.strokeWidth ?? 1;
    const lineWidth = isRiver
      ? RIVER_WIDTH
      : ([
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          strokeWidth,
          6,
          strokeWidth * 3,
        ] as ExpressionSpecification);
    const lineOpacity = layer.visible ? (isRiver ? RIVER_OPACITY : 0.7) : 0;
    map.addLayer(
      {
        id: fillLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": config.strokeColor ?? "var(--color-sky-600)",
          "line-width": lineWidth,
          "line-opacity": lineOpacity,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      },
      beforeId
    );
    return;
  }

  const fillColor: ExpressionSpecification | string =
    config.fillColor === "from-property"
      ? (["coalesce", ["get", "_fillColor"], "#e8e5da"] as ExpressionSpecification)
      : typeof config.fillColor === "string"
        ? config.fillColor
        : "#e8e5da";
  map.addLayer(
    {
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      paint: { "fill-opacity": layer.visible ? config.fillOpacity : 0, "fill-color": fillColor },
    },
    beforeId
  );
  if (config.strokeColor) {
    map.addLayer(
      {
        id: `stroke-${layer.type}`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": config.strokeColor,
          "line-width": config.strokeWidth ?? 1,
          "line-opacity": layer.visible ? 0.8 : 0,
        },
      },
      beforeId
    );
  }
}

/** Applies each background layer's visibility from the world layer list. */
function syncContextLayerVisibility(map: MapLibreMap, worldMapLayers: MapLayerData[]) {
  const politicalVisible = worldMapLayers.some((l) => l.type === "political" && l.visible);

  for (const type of MAP_LAYER_TYPES) {
    const config = LAYER_CONFIGS[type];
    if (type === "political" || !config) continue;
    const isVisible = worldMapLayers.find((l) => l.type === type)?.visible ?? false;
    const fillLayerId = `fill-${type}`;

    if (config.type === "line") {
      setLayerOpacity(map, fillLayerId, "line-opacity", isVisible ? 0.7 : 0);
    } else if (config.type === "fill") {
      // Altitude relief is fully opaque when no political layer sits on top of it.
      const fillOpacity = type === "altitudes" && !politicalVisible ? 1.0 : config.fillOpacity;
      setLayerOpacity(map, fillLayerId, "fill-opacity", isVisible ? fillOpacity : 0);
      setLayerOpacity(map, `stroke-${type}`, "line-opacity", isVisible ? 0.8 : 0);
    }
  }
}

/** Renders the world map context layers (altitudes, rivers, lakes) as editor background. */
export function useWorldContextLayers(
  map: MapLibreMap | null,
  isLoaded: boolean,
  worldMapLayers: MapLayerData[] | undefined,
  theme: MapTheme | undefined
) {
  const lastLoadedDataRef = useRef<Map<string, MapLayerData["data"]>>(new Map());

  useEffect(() => {
    if (!map || !isLoaded || !worldMapLayers || worldMapLayers.length === 0) return;

    const sorted = [...worldMapLayers].sort(
      (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
    );
    const beforeId = EDITOR_LAYER_IDS.find((id) => map.getLayer(id));

    for (const layer of sorted) {
      const config = LAYER_CONFIGS[layer.type];
      if (layer.type === "political" || !config) continue;

      try {
        const existingSource = map.getSource(`source-${layer.type}`);
        if (!existingSource) {
          lastLoadedDataRef.current.set(layer.type, layer.data);
          addContextLayer(map, layer, config, beforeId);
        } else if (lastLoadedDataRef.current.get(layer.type) !== layer.data) {
          lastLoadedDataRef.current.set(layer.type, layer.data);
          (existingSource as GeoJSONSource).setData(layer.data as FeatureCollection);
        }
      } catch (err) {
        console.warn(`[useMapLayers] context layer ${layer.type} error:`, err);
      }
    }

    syncContextLayerVisibility(map, worldMapLayers);
    // oxlint-disable-next-line
  }, [map, isLoaded, worldMapLayers, theme]);
}
