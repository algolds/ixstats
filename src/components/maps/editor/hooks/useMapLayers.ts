import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Polygon, MultiPolygon, Position, FeatureCollection, Geometry } from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import {
  LAYER_CONFIGS,
  MAP_SYMBOL_FONTS,
  MAP_LAYER_TYPES,
} from "~/lib/maps/map-config";
import { getGeoJSONSource, EMPTY_FC, haversineDistance } from "../utils/map-helpers";
import { geoJSONPatcher } from "../utils/geoJsonPatcher";
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
  gapFeatures?: any | null;
  showGaps?: boolean;
  emptyRegionsFeatures?: any | null;
  showEmptyRegions?: boolean;
  lassoGeometry?: any | null;
  rulerPoints?: [number, number][];
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
  const lastLoadedEditorDataRef = useRef<Map<string, any>>(new Map());

  // 1. Render world map context layers (altitudes, rivers, lakes) as background
  useEffect(() => {
    if (!map || !isLoaded || !worldMapLayers || worldMapLayers.length === 0) return;

    const sorted = [...worldMapLayers].sort(
      (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
    );

    const firstEditorLayer = [
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
    ].find((id) => map.getLayer(id));

    for (const layer of sorted) {
      if (layer.type === "political") continue;

      const sourceId = `source-${layer.type}`;
      const fillLayerId = `fill-${layer.type}`;
      const strokeLayerId = `stroke-${layer.type}`;
      const config = LAYER_CONFIGS[layer.type];
      if (!config) continue;

      try {
        const existingSource = map.getSource(sourceId);
        const prevData = lastLoadedEditorDataRef.current.get(layer.type);

        if (existingSource) {
          if (prevData !== layer.data) {
            lastLoadedEditorDataRef.current.set(layer.type, layer.data);
            (existingSource as GeoJSONSource).setData(layer.data as FeatureCollection);
          }
        } else {
          lastLoadedEditorDataRef.current.set(layer.type, layer.data);
          map.addSource(sourceId, {
            type: "geojson",
            data: layer.data as FeatureCollection,
            generateId: true,
            tolerance: 0,
            buffer: 256,
          });

          if (config.type === "line") {
            const isRiver = layer.type === "rivers";
            map.addLayer(
              {
                id: fillLayerId,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": config.strokeColor ?? "#5295c4",
                  "line-width": isRiver
                    ? ([
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
                      ] as any)
                    : ([
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        0,
                        config.strokeWidth ?? 1,
                        6,
                        (config.strokeWidth ?? 1) * 3,
                      ] as [string, ...unknown[]]),
                  "line-opacity": layer.visible
                    ? isRiver
                      ? ([
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
                        ] as unknown as number)
                      : 0.7
                    : 0,
                },
                layout: { "line-cap": "round", "line-join": "round" },
              },
              firstEditorLayer
            );
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

            map.addLayer(
              {
                id: fillLayerId,
                type: "fill",
                source: sourceId,
                paint: fillPaint as Record<string, unknown>,
              },
              firstEditorLayer
            );

            if (config.strokeColor) {
              map.addLayer(
                {
                  id: strokeLayerId,
                  type: "line",
                  source: sourceId,
                  paint: {
                    "line-color": config.strokeColor,
                    "line-width": config.strokeWidth ?? 1,
                    "line-opacity": layer.visible ? 0.8 : 0,
                  },
                },
                firstEditorLayer
              );
            }
          }
        }
      } catch (err) {
        console.warn(`[useMapLayers] context layer ${layer.type} error:`, err);
      }
    }

    // Update visibility and opacity for all background layers in MAP_LAYER_TYPES
    for (const type of MAP_LAYER_TYPES) {
      if (type === "political") continue;
      const activeLayer = worldMapLayers.find((l) => l.type === type);
      const isVisible = activeLayer ? activeLayer.visible : false;
      const fillLayerId = `fill-${type}`;
      const strokeLayerId = `stroke-${type}`;
      const config = LAYER_CONFIGS[type];
      if (!config) continue;

      if (config.type === "line") {
        if (map.getLayer(fillLayerId)) {
          map.setPaintProperty(fillLayerId, "line-opacity", isVisible ? 0.7 : 0);
        }
      } else if (config.type === "fill") {
        if (map.getLayer(fillLayerId)) {
          if (type === "altitudes") {
            const politicalVisible = worldMapLayers.some(
              (l) => l.type === "political" && l.visible
            );
            map.setPaintProperty(
              fillLayerId,
              "fill-opacity",
              isVisible ? (politicalVisible ? config.fillOpacity : 1.0) : 0
            );
          } else {
            map.setPaintProperty(fillLayerId, "fill-opacity", isVisible ? config.fillOpacity : 0);
          }
        }
        if (map.getLayer(strokeLayerId)) {
          map.setPaintProperty(strokeLayerId, "line-opacity", isVisible ? 0.8 : 0);
        }
      }
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, worldMapLayers, theme]);

  // 2. Render country boundary
  useEffect(() => {
    if (!map || !isLoaded || !countryGeometry) return;

    const sourceId = "editor-country-boundary";
    const fillId = "editor-country-fill";
    const strokeId = "editor-country-stroke";

    const geojson: any = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: countryGeometry,
          properties: {},
        },
      ],
    };

    if (map.getSource(sourceId)) {
      getGeoJSONSource(map, sourceId)?.setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#ffffff",
          "fill-opacity": 0.12,
        },
      });
      map.addLayer({
        id: strokeId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#10b981",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      const maskSourceId = "editor-nonplayer-mask";
      const maskFillId = "editor-nonplayer-mask-fill";
      if (!map.getSource(maskSourceId)) {
        const geo = countryGeometry as Polygon | MultiPolygon;
        const worldOuter: Position[] = [
          [-180, -90],
          [180, -90],
          [180, 90],
          [-180, 90],
          [-180, -90],
        ];
        const holes: Position[][] =
          geo.type === "Polygon"
            ? [geo.coordinates[0] as Position[]]
            : (geo.coordinates as Position[][][]).map((poly) => poly[0] as Position[]);

        map.addSource(maskSourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [worldOuter, ...holes] },
            properties: {},
          },
        });
        map.addLayer({
          id: maskFillId,
          type: "fill",
          source: maskSourceId,
          paint: {
            "fill-color": "#0f172a",
            "fill-opacity": 0.4,
          },
        });
      }
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, countryGeometry, countryColor, theme]);

  // 3. Coordinate grid overlay
  useEffect(() => {
    if (!map || !isLoaded) return;

    const gridSourceId = "editor-grid";
    const gridLayerId = "editor-grid-lines";
    const gridLabelId = "editor-grid-labels";

    if (!showGrid) {
      if (map.getLayer(gridLayerId)) map.setLayoutProperty(gridLayerId, "visibility", "none");
      if (map.getLayer(gridLabelId)) map.setLayoutProperty(gridLabelId, "visibility", "none");
      return;
    }

    const bbox = countryBbox;
    const margin = 5;
    const minLng = bbox ? Math.floor((bbox.minLng - margin) / 5) * 5 : -180;
    const maxLng = bbox ? Math.ceil((bbox.maxLng + margin) / 5) * 5 : 180;
    const minLat = bbox ? Math.max(-85, Math.floor((bbox.minLat - margin) / 5) * 5) : -85;
    const maxLat = bbox ? Math.min(85, Math.ceil((bbox.maxLat + margin) / 5) * 5) : 85;

    const spacing = [10, 5, 1, 0.5][gridZoomBucket] ?? 5;

    const lines: GeoJSON.Feature[] = [];
    for (let lng = minLng; lng <= maxLng; lng += spacing) {
      lines.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [lng, minLat],
            [lng, maxLat],
          ],
        },
        properties: { label: `${Math.abs(lng)}°${lng >= 0 ? "E" : "W"}` },
      });
    }
    for (let lat = minLat; lat <= maxLat; lat += spacing) {
      lines.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [minLng, lat],
            [maxLng, lat],
          ],
        },
        properties: { label: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}` },
      });
    }

    const gridFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: lines };

    if (map.getSource(gridSourceId)) {
      getGeoJSONSource(map, gridSourceId)?.setData(gridFc);
      if (map.getLayer(gridLayerId)) map.setLayoutProperty(gridLayerId, "visibility", "visible");
      if (map.getLayer(gridLabelId)) map.setLayoutProperty(gridLabelId, "visibility", "visible");
    } else {
      map.addSource(gridSourceId, { type: "geojson", data: gridFc });
      map.addLayer({
        id: gridLayerId,
        type: "line",
        source: gridSourceId,
        paint: {
          "line-color": "#64748b",
          "line-width": 0.8,
          "line-opacity": 0.4,
          "line-dasharray": [4, 4],
        },
      });
      map.addLayer({
        id: gridLabelId,
        type: "symbol",
        source: gridSourceId,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "label"],
          "text-size": 9,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-max-angle": 90,
          "text-offset": [0, -0.6],
          "text-font": [...MAP_SYMBOL_FONTS.regular],
        },
        paint: {
          "text-color": "#64748b",
          "text-opacity": 0.5,
          "text-halo-color": "#0f172a",
          "text-halo-width": 1,
        },
      });
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, showGrid, gridZoomBucket, countryBbox, theme]);

  // 4. Render existing features (subdivisions, cities, POIs, story pins, map labels)
  useEffect(() => {
    if (!map || !isLoaded) return;

    const lv = layerVisibility ?? {};
    const visibleFeatures = features.filter((f) => {
      if (f.type === "city" && lv.cities === false) return false;
      if (f.type === "poi" && lv.pois === false) return false;
      if (f.type === "storyPin" && lv.stories === false) return false;
      if (f.type === "mapLabel" && lv.labels === false) return false;
      if (f.type === "subdivision" && lv.regions === false) return false;
      if (f.type === "route" && lv.routes === false) return false;
      return true;
    });

    const pointFeatures = visibleFeatures
      .filter((f) => f.coordinates)
      .map((f) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: f.coordinates!,
        },
        properties: {
          id: f.id,
          name: f.name,
          featureType: f.type,
          isCapital: f.properties.isNationalCapital ?? false,
          rotation: Number(f.properties.rotation) || 0,
          opacity: f.properties.opacity !== undefined ? Number(f.properties.opacity) : 1,
          color: f.properties.color || "#374151",
          fontSize: Number(f.properties.fontSize) || 11,
          fontWeight: f.properties.fontWeight || "normal",
          letterSpacing: Number(f.properties.letterSpacing) || 0,
        },
      }));

    const pointsGeoJson = { type: "FeatureCollection" as const, features: pointFeatures };
    geoJSONPatcher.cacheSourceFeatures("editor-points", pointFeatures as any);

    if (map.getSource("editor-points")) {
      getGeoJSONSource(map, "editor-points")?.setData(pointsGeoJson);
    } else {
      map.addSource("editor-points", { type: "geojson", data: pointsGeoJson });
      map.addSource("editor-points-ghost", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-points-ghost-layer",
        type: "circle",
        source: "editor-points-ghost",
        paint: {
          "circle-radius": 6,
          "circle-color": "#a1a1aa",
          "circle-opacity": 0.4,
          "circle-stroke-color": "#52525b",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.5,
        },
      });
      map.addLayer({
        id: "editor-points-capital",
        type: "circle",
        source: "editor-points",
        filter: ["==", ["get", "isCapital"], true],
        paint: {
          "circle-radius": 7,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "editor-points-city",
        type: "circle",
        source: "editor-points",
        filter: ["all", ["==", ["get", "featureType"], "city"], ["!=", ["get", "isCapital"], true]],
        paint: {
          "circle-radius": 5,
          "circle-color": "#3b82f6",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "editor-points-poi",
        type: "circle",
        source: "editor-points",
        filter: ["==", ["get", "featureType"], "poi"],
        paint: {
          "circle-radius": 4,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "editor-points-story-pin",
        type: "circle",
        source: "editor-points",
        filter: ["==", ["get", "featureType"], "storyPin"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#a855f7",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "editor-points-map-label",
        type: "circle",
        source: "editor-points",
        filter: ["==", ["get", "featureType"], "mapLabel"],
        paint: {
          "circle-radius": 4,
          "circle-color": "#94a3b8",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-opacity": 0.6,
        },
      });
      map.addLayer({
        id: "editor-points-labels",
        type: "symbol",
        source: "editor-points",
        filter: ["!=", ["get", "featureType"], "mapLabel"],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-font": [...MAP_SYMBOL_FONTS.regular],
        },
        paint: {
          "text-color": "#374151",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
      map.addLayer({
        id: "editor-map-labels",
        type: "symbol",
        source: "editor-points",
        filter: ["==", ["get", "featureType"], "mapLabel"],
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["get", "fontSize"],
          "text-rotate": ["get", "rotation"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-font": [
            "match",
            ["get", "fontWeight"],
            "bold",
            ["literal", MAP_SYMBOL_FONTS.bold],
            ["literal", MAP_SYMBOL_FONTS.regular],
          ],
        },
        paint: {
          "text-color": ["get", "color"],
          "text-opacity": ["get", "opacity"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
      map.addLayer({
        id: "editor-points-selected",
        type: "circle",
        source: "editor-points",
        paint: {
          "circle-radius": ["case", ["==", ["get", "isCapital"], true], 10, 8],
          "circle-color": "#f59e0b",
          "circle-opacity": 0.35,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }

    const polyFeatures = visibleFeatures
      .filter((f) => f.geometry)
      .map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry as Geometry,
        properties: { id: f.id, name: f.name, color: f.properties.color },
      }));

    const polysGeoJson = { type: "FeatureCollection" as const, features: polyFeatures };

    if (map.getSource("editor-subdivisions")) {
      getGeoJSONSource(map, "editor-subdivisions")?.setData(polysGeoJson);
      const regionsOpacity = layerOpacity?.regions ?? 0.6;
      if (map.getLayer("editor-subdivisions-stroke")) {
        map.setPaintProperty("editor-subdivisions-stroke", "line-opacity", regionsOpacity);
      }
      if (map.getLayer("editor-subdivisions-fill")) {
        map.setPaintProperty("editor-subdivisions-fill", "fill-opacity", 0.05 * regionsOpacity);
      }
      if (map.getLayer("editor-subdivisions-labels")) {
        map.setPaintProperty("editor-subdivisions-labels", "text-opacity", regionsOpacity);
      }
    } else {
      map.addSource("editor-subdivisions", { type: "geojson", data: polysGeoJson });
      map.addLayer({
        id: "editor-subdivisions-fill",
        type: "fill",
        source: "editor-subdivisions",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#7c3aed"],
          "fill-opacity": 0.05 * (layerOpacity?.regions ?? 0.6),
        },
      });
      map.addLayer({
        id: "editor-subdivisions-stroke",
        type: "line",
        source: "editor-subdivisions",
        paint: {
          "line-color": "#7c3aed",
          "line-width": 1.5,
          "line-dasharray": [3, 2],
          "line-opacity": layerOpacity?.regions ?? 0.6,
        },
      });
      map.addLayer({
        id: "editor-subdivisions-labels",
        type: "symbol",
        source: "editor-subdivisions",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-optional": true,
          "symbol-sort-key": 1,
          "text-font": [...MAP_SYMBOL_FONTS.regular],
        },
        paint: {
          "text-color": "#6d28d9",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
          "text-opacity": layerOpacity?.regions ?? 0.6,
        },
      });

      map.addLayer({
        id: "editor-subdivisions-hover",
        type: "line",
        source: "editor-subdivisions",
        paint: {
          "line-color": "#2563eb",
          "line-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });

      map.addLayer({
        id: "editor-subdivisions-selected",
        type: "line",
        source: "editor-subdivisions",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, features, layerVisibility, layerOpacity, theme]);

  // 5. Render pending coordinates marker
  useEffect(() => {
    if (!map || !isLoaded) return;

    const geojson = pendingCoordinates
      ? {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: pendingCoordinates },
              properties: {},
            },
          ],
        }
      : EMPTY_FC;

    if (map.getSource("editor-pending-point")) {
      getGeoJSONSource(map, "editor-pending-point")?.setData(geojson);
    } else {
      map.addSource("editor-pending-point", { type: "geojson", data: geojson });
      map.addLayer({
        id: "editor-pending-point-layer",
        type: "circle",
        source: "editor-pending-point",
        paint: {
          "circle-radius": 8,
          "circle-color": "#10b981",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.8,
        },
      });
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, pendingCoordinates, theme]);

  // 6. Render in-progress route waypoints
  useEffect(() => {
    if (!map || !isLoaded) return;

    const lineGeoJson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features:
        routeWaypoints && routeWaypoints.length >= 2
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: routeWaypoints,
                },
                properties: {},
              },
            ]
          : [],
    };

    const pointGeoJson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: routeWaypoints
        ? routeWaypoints.map((wp) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: wp },
            properties: {},
          }))
        : [],
    };

    const midpointFeatures: any[] = [];
    if (routeWaypoints && routeWaypoints.length >= 2) {
      for (let i = 1; i < routeWaypoints.length; i++) {
        const a = routeWaypoints[i - 1]!;
        const b = routeWaypoints[i]!;
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const dist = haversineDistance(a, b);
        midpointFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: mid },
          properties: { label: `${dist.toFixed(1)} km` },
        });
      }
    }

    if (map.getSource("editor-route-line")) {
      getGeoJSONSource(map, "editor-route-line")?.setData(lineGeoJson);
    } else {
      map.addSource("editor-route-line", { type: "geojson", data: lineGeoJson });
      map.addLayer({
        id: "editor-route-line-layer",
        type: "line",
        source: "editor-route-line",
        paint: {
          "line-color": "#6366f1",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });
    }

    if (map.getSource("editor-route-points")) {
      getGeoJSONSource(map, "editor-route-points")?.setData(pointGeoJson);
    } else {
      map.addSource("editor-route-points", { type: "geojson", data: pointGeoJson });
      map.addLayer({
        id: "editor-route-points-layer",
        type: "circle",
        source: "editor-route-points",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#6366f1",
          "circle-stroke-width": 2,
        },
      });
    }

    if (map.getSource("editor-route-midpoint-labels")) {
      getGeoJSONSource(map, "editor-route-midpoint-labels")?.setData({
        type: "FeatureCollection",
        features: midpointFeatures,
      });
    } else {
      map.addSource("editor-route-midpoint-labels", {
        type: "geojson",
        data: { type: "FeatureCollection", features: midpointFeatures },
      });
      map.addLayer({
        id: "editor-route-midpoint-labels-layer",
        type: "symbol",
        source: "editor-route-midpoint-labels",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 9,
          "text-font": [...MAP_SYMBOL_FONTS.regular],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#4f46e5",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, routeWaypoints, theme]);

  // 7. Initialize empty sources/layers for drawing, vertex editing, and route editing
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Drawing Subdivision sources/layers
    if (!map.getSource("editor-draw-polygon")) {
      map.addSource("editor-draw-polygon", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-draw-polygon-fill",
        type: "fill",
        source: "editor-draw-polygon",
        paint: { "fill-color": "#10b981", "fill-opacity": 0.2 },
      });
      map.addLayer({
        id: "editor-draw-polygon-stroke",
        type: "line",
        source: "editor-draw-polygon",
        paint: { "line-color": "#10b981", "line-width": 2 },
      });

      map.addSource("editor-draw-vertices", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-draw-vertices-layer",
        type: "circle",
        source: "editor-draw-vertices",
        paint: {
          "circle-radius": 5,
          "circle-color": "#10b981",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addSource("editor-overlap-highlight", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-overlap-highlight-fill",
        type: "fill",
        source: "editor-overlap-highlight",
        paint: { "fill-color": "#ef4444", "fill-opacity": 0.4 },
      });
      map.addLayer({
        id: "editor-overlap-highlight-stroke",
        type: "line",
        source: "editor-overlap-highlight",
        paint: { "line-color": "#ef4444", "line-width": 2.5 },
      });
    }

    // Vertex Editing sources/layers
    if (!map.getSource("editor-vedit-polygon")) {
      map.addSource("editor-vedit-polygon", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-vedit-polygon-fill",
        type: "fill",
        source: "editor-vedit-polygon",
        paint: { "fill-color": "#10b981", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: "editor-vedit-polygon-stroke",
        type: "line",
        source: "editor-vedit-polygon",
        paint: { "line-color": "#10b981", "line-width": 2.5 },
      });

      map.addSource("editor-vedit-midpoints", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-vedit-midpoints-layer",
        type: "circle",
        source: "editor-vedit-midpoints",
        paint: {
          "circle-radius": 4,
          "circle-color": "#10b981",
          "circle-opacity": 0.5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("editor-vedit-vertices", { type: "geojson", data: EMPTY_FC });
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      map.addLayer({
        id: "editor-vedit-vertices-layer",
        type: "circle",
        source: "editor-vedit-vertices",
        paint: {
          "circle-radius": isTouchDevice ? 10 : 6,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#10b981",
          "circle-stroke-width": isTouchDevice ? 3 : 2.5,
        },
      });
    }

    // Route Editing & preview sources/layers
    if (!map.getSource("editor-route-edit-line")) {
      map.addSource("editor-route-edit-line", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-route-edit-line-layer",
        type: "line",
        source: "editor-route-edit-line",
        paint: {
          "line-color": "#6366f1",
          "line-width": 3,
          "line-opacity": 0.8,
        },
      });

      map.addSource("editor-route-edit-vertices", { type: "geojson", data: EMPTY_FC });
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      map.addLayer({
        id: "editor-route-edit-vertices-layer",
        type: "circle",
        source: "editor-route-edit-vertices",
        paint: {
          "circle-radius": isTouchDevice ? 10 : 6,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#6366f1",
          "circle-stroke-width": isTouchDevice ? 3 : 2.5,
        },
      });

      map.addSource("editor-route-edit-midpoints", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-route-edit-midpoints-layer",
        type: "circle",
        source: "editor-route-edit-midpoints",
        paint: {
          "circle-radius": 4,
          "circle-color": "#6366f1",
          "circle-opacity": 0.5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("editor-route-snap-preview", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-route-snap-preview-ring",
        type: "circle",
        source: "editor-route-snap-preview",
        paint: {
          "circle-radius": 12,
          "circle-color": "transparent",
          "circle-stroke-color": "#06b6d4",
          "circle-stroke-width": 2,
          "circle-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "editor-route-snap-preview-label",
        type: "symbol",
        source: "editor-route-snap-preview",
        layout: {
          "text-field": ["concat", "Snap to: ", ["get", "name"]],
          "text-size": 10,
          "text-offset": [0, -1.8],
          "text-anchor": "bottom",
          "text-font": [...MAP_SYMBOL_FONTS.regular],
        },
        paint: {
          "text-color": "#06b6d4",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      map.addSource("editor-route-preview-segment", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "editor-route-preview-segment-layer",
        type: "line",
        source: "editor-route-preview-segment",
        paint: {
          "line-color": "#6366f1",
          "line-width": 2,
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        },
      });
    }
  // oxlint-disable-next-line
  }, [map, isLoaded, theme]);

  // 8. Subdivisions fill — kept queryable (paint mode was removed in Plan 024).
  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer("editor-subdivisions-fill")) return;
    map.setPaintProperty("editor-subdivisions-fill", "fill-color", [
      "coalesce",
      ["get", "color"],
      "#7c3aed",
    ]);
    map.setPaintProperty(
      "editor-subdivisions-fill",
      "fill-opacity",
      0.05 * (layerOpacity?.regions ?? 0.6)
    );
  // oxlint-disable-next-line
  }, [map, isLoaded, theme, layerOpacity]);

  // 9. Gap overlay (negative space highlights)
  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "editor-gaps";
    const fillId = "editor-gaps-fill";
    const strokeId = "editor-gaps-stroke";

    const geojson = gapFeatures && showGaps ? gapFeatures : EMPTY_FC;

    if (map.getSource(sourceId)) {
      getGeoJSONSource(map, sourceId)?.setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#f59e0b",
          "fill-opacity": 0.15,
        },
      });
      map.addLayer({
        id: strokeId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#d97706",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });
    }
  }, [map, isLoaded, gapFeatures, showGaps]);

  // 10. Empty subdivisions highlight overlay
  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "editor-empty-subdivisions";
    const fillId = "editor-empty-subdivisions-fill";
    const strokeId = "editor-empty-subdivisions-stroke";

    const geojson = emptyRegionsFeatures && showEmptyRegions ? emptyRegionsFeatures : EMPTY_FC;

    if (map.getSource(sourceId)) {
      getGeoJSONSource(map, sourceId)?.setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#06b6d4",
          "fill-opacity": 0.15,
        },
      });
      map.addLayer({
        id: strokeId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#0891b2",
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      });
    }
  }, [map, isLoaded, emptyRegionsFeatures, showEmptyRegions]);

  // 11. Lasso selection layers
  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "editor-lasso";
    const fillId = "editor-lasso-fill";
    const strokeId = "editor-lasso-stroke";

    const geojson = lassoGeometry
      ? {
          type: "Feature" as const,
          geometry: lassoGeometry,
          properties: {},
        }
      : EMPTY_FC;

    if (map.getSource(sourceId)) {
      getGeoJSONSource(map, sourceId)?.setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.1,
        },
      });
      map.addLayer({
        id: strokeId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#2563eb",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });
    }
  }, [map, isLoaded, lassoGeometry]);

  // 12. Ruler / measuring path layers
  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "editor-ruler";
    const lineId = "editor-ruler-line";
    const pointsId = "editor-ruler-points";
    const labelsId = "editor-ruler-labels";

    const features: any[] = [];
    if (rulerPoints && rulerPoints.length > 0) {
      // Add point features
      rulerPoints.forEach((pt, index) => {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: pt },
          properties: { index: index.toString(), type: "point" },
        });
      });

      // Add line segment feature connecting them
      if (rulerPoints.length > 1) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: rulerPoints },
          properties: { type: "line" },
        });

        // Add midpoint labels with distance calculation
        for (let i = 0; i < rulerPoints.length - 1; i++) {
          const ptA = rulerPoints[i]!;
          const ptB = rulerPoints[i + 1]!;

          // Geodesic distance in km using project's haversine helper
          const segmentDistance = haversineDistance(ptA, ptB);

          // Midpoint
          const midLng = (ptA[0] + ptB[0]) / 2;
          const midLat = (ptA[1] + ptB[1]) / 2;

          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [midLng, midLat] },
            properties: {
              type: "label",
              distance: `${segmentDistance.toFixed(1)} km`,
            },
          });
        }
      }
    }

    const geojson = {
      type: "FeatureCollection" as const,
      features: features,
    };

    if (map.getSource(sourceId)) {
      getGeoJSONSource(map, sourceId)?.setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        filter: ["==", ["get", "type"], "line"],
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2,
        },
      });
      map.addLayer({
        id: pointsId,
        type: "circle",
        source: sourceId,
        filter: ["==", ["get", "type"], "point"],
        paint: {
          "circle-color": "#d97706",
          "circle-radius": 4.5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: labelsId,
        type: "symbol",
        source: sourceId,
        filter: ["==", ["get", "type"], "label"],
        layout: {
          "text-field": ["get", "distance"],
          "text-size": 10,
          "text-anchor": "center",
          "text-offset": [0, -1],
          "text-font": ["Noto Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": "#d97706",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }
  }, [map, isLoaded, rulerPoints]);
}
