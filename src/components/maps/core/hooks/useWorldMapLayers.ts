import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { MapLayerData } from "../IxWorldMap";
import type { MapLayerType, ProjectionMode } from "~/lib/maps/map-config";
import {
  LAYER_CONFIGS,
  WATER_BODY_LABELS,
  MAP_SYMBOL_FONTS,
  MAP_LAYER_TYPES,
} from "~/lib/maps/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";
import { applySmoothProjection } from "../utils/projectionTransition";
import { COUNTRY_LABEL_OPACITY } from "../utils/map-core-helpers";

type LayerConfig = (typeof LAYER_CONFIGS)[MapLayerType];

/** Rivers fade in with zoom (thin, faint at globe view). */
const RIVER_LINE_OPACITY = [
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
];

const lineOpacity = (type: MapLayerType) => (type === "rivers" ? RIVER_LINE_OPACITY : 0.9) as any;

/** `["match", ["get", "rank"], "major", a, "medium", b, c]` for ocean-label styling. */
const byRank = (major: unknown, medium: unknown, rest: unknown) => [
  "match",
  ["get", "rank"],
  "major",
  major,
  "medium",
  medium,
  rest,
];

const graticuleLine = (id: number, label: string, coordinates: number[][]) => ({
  type: "Feature" as const,
  id,
  properties: { label },
  geometry: { type: "LineString" as const, coordinates },
});

/** Symbol layer for country names on `source-country-labels` (distance-faded via `_distFade`). */
function addCountryLabelLayer(map: MapLibreMap) {
  map.addLayer({
    id: "country-name-labels",
    type: "symbol",
    source: "source-country-labels",
    layout: {
      "text-field": ["get", "_displayName"] as unknown as string,
      "text-font": [...MAP_SYMBOL_FONTS.regular],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1.5,
        10,
        3,
        12,
        5,
        14,
      ] as unknown as number,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-optional": true,
      "text-padding": 2,
      "text-max-width": 8,
    },
    paint: {
      "text-color": "#2c2c2c",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.8,
      "text-halo-blur": 0.5,
      "text-opacity": COUNTRY_LABEL_OPACITY,
    },
    minzoom: 1.5,
  });
}

function addOceanLabelLayer(map: MapLibreMap) {
  map.addLayer({
    id: "ocean-labels",
    type: "symbol",
    source: "source-ocean-labels",
    layout: {
      "text-field": ["get", "name"] as unknown as string,
      "text-font": [...MAP_SYMBOL_FONTS.regular],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0.5,
        byRank(14, 10, 8),
        3,
        byRank(20, 14, 11),
        6,
        byRank(26, 18, 14),
      ] as unknown as number,
      "text-letter-spacing": byRank(0.2, 0.1, 0.05) as unknown as number,
      "text-allow-overlap": false,
      "text-max-width": 12,
      "text-padding": 5,
    },
    paint: {
      "text-color": byRank("#1a5276", "#2874a6", "#3498db") as unknown as string,
      "text-halo-color": "rgba(179, 205, 224, 0.6)",
      "text-halo-width": 1,
      "text-opacity": [
        "step",
        ["zoom"],
        ["match", ["get", "rank"], "major", 0.8, 0],
        1.5,
        byRank(0.9, 0.7, 0),
        3,
        0.9,
      ] as unknown as number,
    },
    minzoom: 0.5,
  });
}

/** Graticule lines and ocean/sea name labels, created once and refreshed in place. */
function syncGraticuleAndOceanLabels(map: MapLibreMap, showOceanLabels: boolean) {
  const graticuleData = {
    type: "FeatureCollection" as const,
    features: [
      graticuleLine(1, "Equator", [
        [-180, 0],
        [180, 0],
      ]),
      graticuleLine(2, "Prime Meridian", [
        [56.1842, -90],
        [56.1842, 90],
      ]),
    ],
  };

  const oceanLabelsData = {
    type: "FeatureCollection" as const,
    features: showOceanLabels
      ? WATER_BODY_LABELS.map((wb, i) => ({
          type: "Feature" as const,
          id: i + 1,
          geometry: { type: "Point" as const, coordinates: wb.coordinates },
          properties: { name: wb.name, wbType: wb.type, rank: wb.rank },
        }))
      : [],
  };

  const graticuleSource = map.getSource("graticule") as GeoJSONSource | undefined;
  if (graticuleSource) {
    graticuleSource.setData(graticuleData);
  } else {
    map.addSource("graticule", { type: "geojson", data: graticuleData, generateId: true });
    map.addLayer({
      id: "graticule-lines",
      type: "line",
      source: "graticule",
      paint: { "line-color": "rgba(0,0,0,0.12)", "line-width": 0.8, "line-dasharray": [6, 4] },
    });
  }

  const oceanSource = map.getSource("source-ocean-labels") as GeoJSONSource | undefined;
  if (oceanSource) {
    oceanSource.setData(oceanLabelsData);
    return;
  }
  map.addSource("source-ocean-labels", {
    type: "geojson",
    data: oceanLabelsData,
    generateId: true,
  });
  if (showOceanLabels && oceanLabelsData.features.length > 0 && !map.getLayer("ocean-labels")) {
    addOceanLabelLayer(map);
  }
}

function addLineLayer(
  map: MapLibreMap,
  layer: MapLayerData,
  config: LayerConfig,
  sourceId: string
) {
  const strokeWidth = config.strokeWidth ?? 1;
  map.addLayer({
    id: `fill-${layer.type}`,
    type: "line",
    source: sourceId,
    paint: {
      "line-color": ["coalesce", ["get", "fill"], config.strokeColor ?? "#5295c4"] as any,
      "line-width":
        layer.type === "rivers"
          ? ["interpolate", ["exponential", 1.2], ["zoom"], 0, 0.4, 2, 0.6, 4, 1.0, 6, 1.8, 9, 3.2]
          : ["interpolate", ["linear"], ["zoom"], 0, strokeWidth, 6, strokeWidth * 2],
      "line-opacity": lineOpacity(layer.type),
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: layer.visible ? "visible" : "none",
    },
  });
}

function addSovereigntyLayers(map: MapLibreMap, layer: MapLayerData, sourceId: string) {
  if (!layer.data.features.some((f) => f.properties?._sovereignId)) return;

  if (!map.getLayer("sovereignty-border")) {
    map.addLayer({
      id: "sovereignty-border",
      type: "line",
      source: sourceId,
      filter: ["has", "_sovereignId"],
      paint: {
        "line-color": ["coalesce", ["get", "_fillColor"], "#888"] as any,
        "line-width": 2.5,
        "line-dasharray": [4, 2],
        "line-opacity": layer.visible ? 0.7 : 0,
      },
    });
  }

  if (!map.getLayer("sovereignty-labels")) {
    map.addLayer({
      id: "sovereignty-labels",
      type: "symbol",
      source: sourceId,
      filter: ["has", "_sovereignId"],
      layout: {
        "text-field": [
          "concat",
          ["get", "_displayName"],
          "\n",
          ["get", "_relationLabel"],
          " of ",
          ["get", "_sovereignName"],
        ] as any,
        "text-size": 9,
        "text-offset": [0, 1.5],
        "text-allow-overlap": false,
      },
      paint: { "text-color": "#6b5b3d", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      minzoom: 4,
    });
  }
}

function addFillLayers(
  map: MapLibreMap,
  layer: MapLayerData,
  config: LayerConfig,
  sourceId: string
) {
  map.addLayer({
    id: `fill-${layer.type}`,
    type: "fill",
    source: sourceId,
    paint: {
      "fill-opacity": layer.visible ? config.fillOpacity : 0,
      "fill-color":
        config.fillColor === "from-property"
          ? ["coalesce", ["get", "_fillColor"], "#e8e5da"]
          : config.fillColor,
    } as Record<string, unknown>,
  });

  if (config.strokeColor) {
    map.addLayer({
      id: `stroke-${layer.type}`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": config.strokeColor,
        "line-width": config.strokeWidth ?? 1,
        "line-opacity": layer.visible ? 0.8 : 0,
      },
    });
  }

  if (layer.type === "political") addSovereigntyLayers(map, layer, sourceId);
}

/**
 * Show/hide every known layer. Hidden layers are switched off with `visibility: none` rather
 * than opacity 0: MapLibre still tiles, builds buckets for and draws a layer at opacity 0, so
 * hidden climate, biomes, ice caps etc. used to cost worker and GPU time on every pan/zoom.
 * The political fill is the exception — it stays queryable (hover/click) at opacity 0.
 */
function applyLayerVisibility(map: MapLibreMap, layers: MapLayerData[], labelsVisible: boolean) {
  const politicalVisible = layers.some((l) => l.type === "political" && l.visible);
  const setVisibility = (id: string, visible: boolean) =>
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");

  for (const type of MAP_LAYER_TYPES) {
    const config = LAYER_CONFIGS[type];
    if (type === "country_labels" || !config) continue;
    const isVisible = !!layers.find((l) => l.type === type)?.visible;
    const fillLayerId = `fill-${type}`;
    const strokeLayerId = `stroke-${type}`;

    if (map.getLayer(fillLayerId)) {
      if (type === "political") {
        map.setPaintProperty(
          fillLayerId,
          "fill-opacity",
          isVisible
            ? ["case", ["boolean", ["feature-state", "hover"], false], 0.6, config.fillOpacity]
            : 0
        );
      } else {
        if (config.type === "line" && type !== "altitudes") {
          map.setPaintProperty(fillLayerId, "line-opacity", lineOpacity(type));
        } else {
          const opacity = type === "altitudes" && !politicalVisible ? 1 : config.fillOpacity;
          map.setPaintProperty(fillLayerId, "fill-opacity", opacity);
        }
        setVisibility(fillLayerId, isVisible);
      }
    }

    if (map.getLayer(strokeLayerId)) {
      map.setPaintProperty(strokeLayerId, "line-opacity", 0.8);
      setVisibility(strokeLayerId, isVisible);
    }

    if (type !== "political") continue;
    if (map.getLayer("sovereignty-border")) {
      map.setPaintProperty("sovereignty-border", "line-opacity", 0.7);
      setVisibility("sovereignty-border", isVisible);
    }
    if (map.getLayer("sovereignty-labels")) {
      map.setPaintProperty("sovereignty-labels", "text-opacity", isVisible ? 1 : 0);
    }
    if (map.getLayer("country-name-labels")) {
      map.setPaintProperty(
        "country-name-labels",
        "text-opacity",
        isVisible ? COUNTRY_LABEL_OPACITY : 0
      );
    }
  }

  if (map.getLayer("country-name-labels")) {
    const labelsLayer = layers.find((l) => l.type === "country_labels");
    setVisibility("country-name-labels", !!labelsLayer?.visible && labelsVisible);
  }
}

interface UseWorldMapLayersProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  layers: MapLayerData[];
  projectionMode: ProjectionMode;
  topCountryNames?: Set<string>;
  updateDistanceFade: () => void;
  labelFeaturesRef: React.MutableRefObject<FeatureCollection | null>;
  fullLayerDataRef: React.MutableRefObject<Map<string, FeatureCollection>>;
  theme?: MapTheme;
  showOceanLabels?: boolean;
  /** The global "Labels" toggle; country names stay hidden while it is off. */
  labelsVisible?: boolean;
}

export function useWorldMapLayers({
  map,
  isLoaded,
  layers,
  projectionMode,
  topCountryNames,
  updateDistanceFade,
  labelFeaturesRef,
  fullLayerDataRef,
  theme,
  showOceanLabels = true,
  labelsVisible = true,
}: UseWorldMapLayersProps) {
  useEffect(() => {
    if (!map || !isLoaded) return;
    applySmoothProjection(map, projectionMode);
  }, [map, projectionMode, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    try {
      syncGraticuleAndOceanLabels(map, showOceanLabels);
    } catch (err) {
      console.error("[useWorldMapLayers] Failed to add base components", err);
    }
  }, [map, isLoaded, theme]);

  const lastLoadedDataRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sortedLayers = [...layers].sort(
      (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
    );

    for (const layer of sortedLayers) {
      const config = LAYER_CONFIGS[layer.type];
      if (!config) continue;
      const sourceId = `source-${layer.type}`;
      const isLabels = layer.type === "country_labels";

      try {
        // Country labels are point features rendered by one symbol layer on their own source
        // (`source-country-labels`, handled on data change only). They used to also get a
        // generic `source-country_labels` + (invisible) fill layer, so the worker tiled the
        // same points twice; and on a remount of the persistent map the label source/ref was
        // never refreshed.
        const targetSource = isLabels ? "source-country-labels" : sourceId;
        if (layer.type === "rivers" || layer.type === "lakes") {
          fullLayerDataRef.current.set(layer.type, layer.data);
        }

        const source = map.getSource(targetSource) as GeoJSONSource | undefined;
        const changed = lastLoadedDataRef.current.get(layer.type) !== layer.data;
        if (!changed && (isLabels || source)) continue;
        lastLoadedDataRef.current.set(layer.type, layer.data);

        if (isLabels) labelFeaturesRef.current = layer.data;
        if (source) {
          source.setData(layer.data);
        } else {
          map.addSource(targetSource, {
            type: "geojson",
            data: layer.data,
            generateId: true,
            ...(!isLabels && { tolerance: 0, buffer: 256 }),
          });
        }

        if (isLabels) {
          if (!map.getLayer("country-name-labels")) addCountryLabelLayer(map);
          updateDistanceFade();
        } else if (!source && config.type === "line") {
          addLineLayer(map, layer, config, sourceId);
        } else if (!source && config.type === "fill") {
          addFillLayers(map, layer, config, sourceId);
        }
      } catch (err) {
        console.error("[useWorldMapLayers] Failed to add layer", layer.type, err);
      }
    }

    applyLayerVisibility(map, layers, labelsVisible);
  }, [
    map,
    isLoaded,
    layers,
    topCountryNames,
    updateDistanceFade,
    labelFeaturesRef,
    fullLayerDataRef,
    theme,
    labelsVisible,
  ]);
}
