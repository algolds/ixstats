import { useEffect, useRef } from "react";
import type { ExpressionSpecification, Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { MapLayerData } from "../IxWorldMap";
import type { MapLayerType, ProjectionMode } from "~/lib/maps/map-config";
import {
  LAYER_CONFIGS,
  MAP_SYMBOL_FONTS,
  MAP_LAYER_TYPES,
  IXWORLD_PRIME_MERIDIAN_LNG,
} from "~/lib/maps/map-config";
import type { OceanLabelFeature } from "~/lib/maps/ocean-labels";
import type { MapTheme } from "~/lib/map-styles/registry";
import { applySmoothProjection } from "../utils/projectionTransition";
import { useDecorativeTiles } from "./useDecorativeTiles";
import { COUNTRY_LABEL_OPACITY } from "../utils/map-core-helpers";

type LayerConfig = (typeof LAYER_CONFIGS)[MapLayerType];

const NO_OCEAN_LABELS: OceanLabelFeature[] = [];

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
    // Names faded out by distance still took part in collision, costing placement and hiding
    // visible names; leave them out
    filter: [">", ["coalesce", ["get", "_distFade"], 1], 0],
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

/** Graticule lines (IxWorld's prime meridian only on IxWorld) and ocean/sea name labels, refreshed in place. */
function syncGraticuleAndOceanLabels(
  map: MapLibreMap,
  oceanLabels: OceanLabelFeature[],
  showPrimeMeridian: boolean
) {
  const graticuleData = {
    type: "FeatureCollection" as const,
    features: [
      graticuleLine(1, "Equator", [
        [-180, 0],
        [180, 0],
      ]),
      ...(showPrimeMeridian
        ? [
            graticuleLine(2, "Prime Meridian", [
              [IXWORLD_PRIME_MERIDIAN_LNG, -90],
              [IXWORLD_PRIME_MERIDIAN_LNG, 90],
            ]),
          ]
        : []),
    ],
  };

  const oceanLabelsData = { type: "FeatureCollection" as const, features: oceanLabels };

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

  // The theme style carries the `ocean-labels` layer and its look (src/lib/map-styles/*.json)
  const oceanSource = map.getSource("source-ocean-labels") as GeoJSONSource | undefined;
  if (oceanSource) {
    oceanSource.setData(oceanLabelsData);
  } else {
    map.addSource("source-ocean-labels", { type: "geojson", data: oceanLabelsData });
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

/** Hover highlight on the political fill: over `rest` normally, over nothing in art mode. */
const politicalFillOpacity = (rest: number, artMode: boolean): ExpressionSpecification => [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  artMode ? 0.35 : 0.6,
  artMode ? 0 : rest,
];

/**
 * The political layer's look. In art mode (a realm's base map art is shown, which carries names and borders of its
 * own) the fill is transparent except under the pointer and the borders are hidden; the selected country keeps its
 * own highlight layer.
 */
function applyPoliticalVisibility(map: MapLibreMap, isVisible: boolean, artMode: boolean) {
  const config = LAYER_CONFIGS.political;
  const setVisibility = (id: string, visible: boolean) =>
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  if (map.getLayer("fill-political")) {
    map.setPaintProperty(
      "fill-political",
      "fill-opacity",
      isVisible ? politicalFillOpacity(config.fillOpacity, artMode) : 0
    );
  }
  for (const id of ["stroke-political", "sovereignty-border"]) {
    if (map.getLayer(id)) setVisibility(id, isVisible && !artMode);
  }
  if (map.getLayer("stroke-political"))
    map.setPaintProperty("stroke-political", "line-opacity", 0.8);
  if (map.getLayer("sovereignty-border")) {
    map.setPaintProperty("sovereignty-border", "line-opacity", 0.7);
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

/**
 * Show/hide every known layer. Hidden layers are switched off with `visibility: none` rather
 * than opacity 0: MapLibre still tiles, builds buckets for and draws a layer at opacity 0, so
 * hidden climate, biomes, ice caps etc. used to cost worker and GPU time on every pan/zoom.
 * The political fill is the exception — it stays queryable (hover/click) at opacity 0.
 */
function applyLayerVisibility(
  map: MapLibreMap,
  layers: MapLayerData[],
  labelsVisible: boolean,
  artMode: boolean
) {
  const politicalVisible = layers.some((l) => l.type === "political" && l.visible);
  const setVisibility = (id: string, visible: boolean) =>
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");

  for (const type of MAP_LAYER_TYPES) {
    const config = LAYER_CONFIGS[type];
    if (type === "country_labels" || type === "political" || !config) continue;
    const isVisible = !!layers.find((l) => l.type === type)?.visible;
    const fillLayerId = `fill-${type}`;
    const strokeLayerId = `stroke-${type}`;

    if (map.getLayer(fillLayerId)) {
      if (config.type === "line" && type !== "altitudes") {
        map.setPaintProperty(fillLayerId, "line-opacity", lineOpacity(type));
      } else {
        const opacity = type === "altitudes" && !politicalVisible ? 1 : config.fillOpacity;
        map.setPaintProperty(fillLayerId, "fill-opacity", opacity);
      }
      setVisibility(fillLayerId, isVisible);
    }

    if (map.getLayer(strokeLayerId)) {
      map.setPaintProperty(strokeLayerId, "line-opacity", 0.8);
      setVisibility(strokeLayerId, isVisible);
    }
  }
  applyPoliticalVisibility(map, politicalVisible, artMode);

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
  theme?: MapTheme;
  /** The ocean-label layer's names: IxWorld's water names on IxWorld (AT-2), and the realm's own labels. */
  oceanLabels?: OceanLabelFeature[];
  /** IxWorld's prime meridian line; off unless the map shows IxWorld. */
  showPrimeMeridian?: boolean;
  /** The global "Labels" toggle; country names stay hidden while it is off. */
  labelsVisible?: boolean;
  /** The realm whose decorative layers to draw from vector tiles; undefined until it is known. */
  tileRealmId?: string;
  /** A realm's base map art is shown: political fills and borders give way to the art's. */
  artMode?: boolean;
}

export function useWorldMapLayers({
  map,
  isLoaded,
  layers,
  projectionMode,
  topCountryNames,
  updateDistanceFade,
  labelFeaturesRef,
  theme,
  oceanLabels = NO_OCEAN_LABELS,
  showPrimeMeridian = false,
  labelsVisible = true,
  tileRealmId,
  artMode = false,
}: UseWorldMapLayersProps) {
  useEffect(() => {
    if (!map || !isLoaded) return;
    applySmoothProjection(map, projectionMode);
  }, [map, projectionMode, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    try {
      syncGraticuleAndOceanLabels(map, oceanLabels, showPrimeMeridian);
    } catch (err) {
      console.error("[useWorldMapLayers] Failed to add base components", err);
    }
  }, [map, isLoaded, theme, oceanLabels, showPrimeMeridian]);

  const lastLoadedDataRef = useRef<Map<string, unknown>>(new Map());
  const lastThemeRef = useRef(theme);

  useEffect(() => {
    if (!map || !isLoaded) return;
    // A theme change re-applies the base style, whose sources are empty: push everything again
    if (lastThemeRef.current !== theme) {
      lastThemeRef.current = theme;
      lastLoadedDataRef.current.clear();
    }

    const sortedLayers = [...layers].sort(
      (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
    );

    for (const layer of sortedLayers) {
      const config = LAYER_CONFIGS[layer.type];
      if (!config) continue;
      const sourceId = `source-${layer.type}`;
      // On /maps the decorative sources are vector tiles (effect below) and these layers are listed
      // only for visibility; maps that pass their own GeoJSON (the pipeline lab) still get it pushed
      if (map.getSource(sourceId)?.type === "vector") continue;
      const isLabels = layer.type === "country_labels";

      try {
        // Country labels are point features rendered by one symbol layer on their own source
        // (`source-country-labels`, handled on data change only). They used to also get a
        // generic `source-country_labels` + (invisible) fill layer, so the worker tiled the
        // same points twice; and on a remount of the persistent map the label source/ref was
        // never refreshed.
        const targetSource = isLabels ? "source-country-labels" : sourceId;
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

    applyLayerVisibility(map, layers, labelsVisible, artMode);
  }, [
    map,
    isLoaded,
    layers,
    topCountryNames,
    updateDistanceFade,
    labelFeaturesRef,
    theme,
    labelsVisible,
    artMode,
  ]);

  useDecorativeTiles(map, isLoaded, tileRealmId);
}
