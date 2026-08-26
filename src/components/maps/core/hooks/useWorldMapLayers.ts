import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { MapLayerData } from "../IxWorldMap";
import type { ProjectionMode } from "~/lib/maps/map-config";
import {
  LAYER_CONFIGS,
  WATER_BODY_LABELS,
  MAP_SYMBOL_FONTS,
  MAP_LAYER_TYPES,
} from "~/lib/maps/map-config";
import type { MapTheme } from "~/lib/map-styles/registry";
import { applySmoothProjection } from "../utils/projectionTransition";
import { filterByArea, COUNTRY_LABEL_OPACITY } from "../utils/map-core-helpers";

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
}: UseWorldMapLayersProps) {
  // Update projection spec when mode changes
  useEffect(() => {
    if (!map || !isLoaded) return;
    applySmoothProjection(map, projectionMode);
  }, [map, projectionMode, isLoaded]);

  // Initial graticules, ocean labels
  useEffect(() => {
    if (!map || !isLoaded) return;

    try {
      const graticuleData = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: 1,
            properties: { label: "Equator" },
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [-180, 0],
                [180, 0],
              ],
            },
          },
          {
            type: "Feature" as const,
            id: 2,
            properties: { label: "Prime Meridian" },
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [56.1842, -90],
                [56.1842, 90],
              ],
            },
          },
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

      const graticuleSource = map.getSource("graticule");
      if (graticuleSource) {
        (graticuleSource as GeoJSONSource).setData(graticuleData);
      } else {
        map.addSource("graticule", {
          type: "geojson",
          data: graticuleData,
          generateId: true,
        });
        map.addLayer({
          id: "graticule-lines",
          type: "line",
          source: "graticule",
          paint: {
            "line-color": "rgba(0,0,0,0.12)",
            "line-width": 0.8,
            "line-dasharray": [6, 4],
          },
        });
      }

      const oceanLabelsSource = map.getSource("source-ocean-labels");
      if (oceanLabelsSource) {
        (oceanLabelsSource as GeoJSONSource).setData(oceanLabelsData);
      } else {
        map.addSource("source-ocean-labels", {
          type: "geojson",
          data: oceanLabelsData,
          generateId: true,
        });
        if (
          showOceanLabels &&
          oceanLabelsData.features.length > 0 &&
          !map.getLayer("ocean-labels")
        ) {
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
                ["match", ["get", "rank"], "major", 14, "medium", 10, 8],
                3,
                ["match", ["get", "rank"], "major", 20, "medium", 14, 11],
                6,
                ["match", ["get", "rank"], "major", 26, "medium", 18, 14],
              ] as unknown as number,
              "text-letter-spacing": [
                "match",
                ["get", "rank"],
                "major",
                0.2,
                "medium",
                0.1,
                0.05,
              ] as unknown as number,
              "text-allow-overlap": false,
              "text-max-width": 12,
              "text-padding": 5,
            },
            paint: {
              "text-color": [
                "match",
                ["get", "rank"],
                "major",
                "#1a5276",
                "medium",
                "#2874a6",
                "#3498db",
              ] as unknown as string,
              "text-halo-color": "rgba(179, 205, 224, 0.6)",
              "text-halo-width": 1,
              "text-opacity": [
                "step",
                ["zoom"],
                ["match", ["get", "rank"], "major", 0.8, 0],
                1.5,
                ["match", ["get", "rank"], "major", 0.9, "medium", 0.7, 0],
                3,
                0.9,
              ] as unknown as number,
            },
            minzoom: 0.5,
          });
        }
      }
    } catch (err) {
      console.error("[useWorldMapLayers] Failed to add base components", err);
    }
  }, [map, isLoaded, theme]);

  const lastLoadedDataRef = useRef<Map<string, any>>(new Map());

  // Render/update base sorted layers
  useEffect(() => {
    if (!map || !isLoaded) return;

    const sortedLayers = [...layers].sort(
      (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
    );

    for (const layer of sortedLayers) {
      const sourceId = `source-${layer.type}`;
      const fillLayerId = `fill-${layer.type}`;
      const strokeLayerId = `stroke-${layer.type}`;
      const config = LAYER_CONFIGS[layer.type];
      if (!config) continue;

      try {
        if (layer.type === "rivers" || layer.type === "lakes") {
          fullLayerDataRef.current.set(layer.type, layer.data);
        }

        const existingSource = map.getSource(sourceId);
        const prevData = lastLoadedDataRef.current.get(layer.type);

        if (existingSource) {
          // ONLY call setData if layer data reference has actually changed
          if (prevData !== layer.data) {
            lastLoadedDataRef.current.set(layer.type, layer.data);
            (existingSource as GeoJSONSource).setData(layer.data);
          }
        } else {
          lastLoadedDataRef.current.set(layer.type, layer.data);
          map.addSource(sourceId, {
            type: "geojson",
            data: layer.data,
            generateId: true,
            tolerance: 0,
            buffer: 256,
          });

          if (config.type === "line") {
            const isRiver = layer.type === "rivers";
            map.addLayer({
              id: fillLayerId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": ["coalesce", ["get", "fill"], config.strokeColor ?? "#5295c4"] as any,
                "line-width": isRiver
                  ? [
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
                    ]
                  : [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      0,
                      config.strokeWidth ?? 1,
                      6,
                      (config.strokeWidth ?? 1) * 2,
                    ],
                "line-opacity": layer.visible
                  ? isRiver
                    ? [
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
                      ]
                    : 0.9
                  : 0,
              },
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
            });
          }

          if (config.type === "fill") {
            const fillPaint: Record<string, unknown> = {
              "fill-opacity": layer.visible ? config.fillOpacity : 0,
            };

            if (config.fillColor === "from-property") {
              fillPaint["fill-color"] = ["coalesce", ["get", "_fillColor"], "#e8e5da"];
            } else {
              fillPaint["fill-color"] = config.fillColor;
            }

            map.addLayer({
              id: fillLayerId,
              type: "fill",
              source: sourceId,
              paint: fillPaint,
            });

            if (config.strokeColor) {
              map.addLayer({
                id: strokeLayerId,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": config.strokeColor,
                  "line-width": config.strokeWidth ?? 1,
                  "line-opacity": layer.visible ? 0.8 : 0,
                },
              });
            }

            if (layer.type === "political") {
              const hasSovereign = layer.data?.features?.some(
                (f: any) => f.properties && f.properties._sovereignId
              );

              if (hasSovereign) {
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
                    paint: {
                      "text-color": "#6b5b3d",
                      "text-halo-color": "#ffffff",
                      "text-halo-width": 1.5,
                    },
                    minzoom: 4,
                  });
                }
              }
            }
          }

          if (layer.type === "country_labels") {
            labelFeaturesRef.current = layer.data;
            const existingLabelSource = map.getSource("source-country-labels") as
              GeoJSONSource | undefined;
            if (existingLabelSource) {
              existingLabelSource.setData(layer.data as unknown as GeoJSON.GeoJSON);
              updateDistanceFade();
            } else {
              map.addSource("source-country-labels", {
                type: "geojson",
                data: layer.data as unknown as GeoJSON.GeoJSON,
                generateId: true,
              });
              if (layer.data?.features?.length > 0 && !map.getLayer("country-name-labels")) {
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
                    "text-opacity": COUNTRY_LABEL_OPACITY as unknown as number,
                  },
                  minzoom: 1.5,
                });
                updateDistanceFade();
              }
            }
          }
        }
      } catch (err) {
        console.error("[useWorldMapLayers] Failed to add layer", layer.type, err);
      }
    }

    // Update visibilities/opacity for all layers in MAP_LAYER_TYPES
    for (const type of MAP_LAYER_TYPES) {
      const activeLayer = layers.find((l) => l.type === type);
      const isVisible = activeLayer ? activeLayer.visible : false;
      const fillLayerId = `fill-${type}`;
      const strokeLayerId = `stroke-${type}`;
      const config = LAYER_CONFIGS[type];
      if (!config) continue;

      const fillLayer = map.getLayer(fillLayerId);
      if (fillLayer) {
        if (type === "political") {
          map.setPaintProperty(
            fillLayerId,
            "fill-opacity",
            isVisible
              ? ["case", ["boolean", ["feature-state", "hover"], false], 0.6, config.fillOpacity]
              : 0
          );
        } else if (type === "altitudes") {
          const politicalVisible = layers.some((l) => l.type === "political" && l.visible);
          map.setPaintProperty(
            fillLayerId,
            "fill-opacity",
            isVisible ? (politicalVisible ? config.fillOpacity : 1.0) : 0
          );
        } else if (config.type === "line") {
          map.setPaintProperty(fillLayerId, "line-opacity", isVisible ? 0.9 : 0);
        } else {
          map.setPaintProperty(fillLayerId, "fill-opacity", isVisible ? config.fillOpacity : 0);
        }
      }

      const strokeLayer = map.getLayer(strokeLayerId);
      if (strokeLayer) {
        map.setPaintProperty(strokeLayerId, "line-opacity", isVisible ? 0.8 : 0);
      }

      if (type === "political") {
        if (map.getLayer("sovereignty-border")) {
          map.setPaintProperty("sovereignty-border", "line-opacity", isVisible ? 0.7 : 0);
        }
        if (map.getLayer("sovereignty-labels")) {
          map.setPaintProperty("sovereignty-labels", "text-opacity", isVisible ? 1 : 0);
        }
        if (map.getLayer("country-name-labels")) {
          map.setPaintProperty(
            "country-name-labels",
            "text-opacity",
            isVisible ? (COUNTRY_LABEL_OPACITY as unknown as number) : 0
          );
        }
      }

      if (type === "country_labels") {
        if (map.getLayer("country-name-labels")) {
          map.setLayoutProperty(
            "country-name-labels",
            "visibility",
            isVisible ? "visible" : "none"
          );
        }
      }
    }
  }, [
    map,
    isLoaded,
    layers,
    topCountryNames,
    updateDistanceFade,
    labelFeaturesRef,
    fullLayerDataRef,
    theme,
  ]);
}
