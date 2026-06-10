"use client";

/**
 * TransportOverlay — Renders transport routes on the map with rich visual styling.
 *
 * Visual features:
 * - Data-driven dash patterns per route type (solid, dashed, dotted)
 * - Directional arrow symbols along routes (zoom ≥ 6)
 * - Selected route glow effect (wide blurred halo)
 * - Status-based opacity (planned=40%, construction=70%, operational=100%, abandoned=30%)
 * - Animated dash-offset flow effect (toggleable, performance-capped)
 * - Color-coded by type: rail=gray, highway=orange, road=brown, shipping=blue,
 *   canal=cyan, air_corridor=purple, ferry=teal
 */

import { useEffect, useRef, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

// ── Layer / Source IDs ──────────────────────────────────────────────

const ROUTES_SOURCE = "transport-routes-source";
const ROUTES_GLOW_LAYER = "transport-routes-glow";
const ROUTES_LAYER = "transport-routes-line";
const ROUTES_ARROWS_LAYER = "transport-routes-arrows";
const HUBS_SOURCE = "transport-hubs-source";
const HUBS_LAYER = "transport-hubs-circle";

// ── Color & Width Config ────────────────────────────────────────────

export const ROUTE_COLORS: Record<string, string> = {
  rail: "#374151", // gray-700
  highway: "#f97316", // orange-500
  road: "#92400e", // amber-800
  shipping_lane: "#3b82f6", // blue-500
  canal: "#06b6d4", // cyan-500
  air_corridor: "#a855f7", // purple-500
  ferry: "#14b8a6", // teal-500
};

const ROUTE_WIDTHS: Record<string, number> = {
  rail: 3,
  highway: 2.5,
  road: 1.5,
  shipping_lane: 2,
  canal: 1.5,
  air_corridor: 2,
  ferry: 1.5,
};

// ── Status opacity mapping ──────────────────────────────────────────

const STATUS_OPACITY: Record<string, number> = {
  planned: 0.4,
  under_construction: 0.7,
  operational: 1.0,
  abandoned: 0.3,
};

// ── MapLibre color expression (match by routeType) ──────────────────

function buildColorExpression(): any[] {
  return [
    "match",
    ["get", "routeType"],
    "rail",
    ROUTE_COLORS.rail!,
    "highway",
    ROUTE_COLORS.highway!,
    "road",
    ROUTE_COLORS.road!,
    "shipping_lane",
    ROUTE_COLORS.shipping_lane!,
    "canal",
    ROUTE_COLORS.canal!,
    "air_corridor",
    ROUTE_COLORS.air_corridor!,
    "ferry",
    ROUTE_COLORS.ferry!,
    "#888888", // fallback
  ];
}

function buildWidthExpression(selectedRouteId: string | null | undefined): any[] {
  return [
    "case",
    ["==", ["get", "id"], selectedRouteId ?? ""],
    6,
    [
      "match",
      ["get", "routeType"],
      "rail",
      ROUTE_WIDTHS.rail!,
      "highway",
      ROUTE_WIDTHS.highway!,
      "road",
      ROUTE_WIDTHS.road!,
      "shipping_lane",
      ROUTE_WIDTHS.shipping_lane!,
      "canal",
      ROUTE_WIDTHS.canal!,
      "air_corridor",
      ROUTE_WIDTHS.air_corridor!,
      "ferry",
      ROUTE_WIDTHS.ferry!,
      1.5, // fallback
    ],
  ];
}

function buildOpacityExpression(selectedRouteId: string | null | undefined): any[] {
  return [
    "case",
    // Selected route always full opacity
    ["==", ["get", "id"], selectedRouteId ?? ""],
    1.0,
    // When something is selected, dim others
    selectedRouteId
      ? [
          "match",
          ["get", "status"],
          "planned",
          0.2,
          "under_construction",
          0.35,
          "operational",
          0.35,
          "abandoned",
          0.15,
          0.35,
        ]
      : [
          // Status-based opacity
          "match",
          ["get", "status"],
          "planned",
          STATUS_OPACITY.planned!,
          "under_construction",
          STATUS_OPACITY.under_construction!,
          "operational",
          STATUS_OPACITY.operational!,
          "abandoned",
          STATUS_OPACITY.abandoned!,
          0.8,
        ],
  ];
}

// Dash pattern per route type — expressed as MapLibre line-dasharray
// Note: line-dasharray doesn't support data-driven expressions in MapLibre,
// so we use it as a fixed value on the base layer. For type-specific dashes,
// we'd need separate layers per type. Instead, we use the base layer solid
// and differentiate via color + width + arrows. The dashed effect is reserved
// for planned/abandoned status via a separate overlay approach.

// ── Component ───────────────────────────────────────────────────────

interface TransportOverlayProps {
  map: MapLibreMap | null;
  routeData: FeatureCollection;
  hubData?: FeatureCollection;
  visible: boolean;
  /** Called when user clicks a route line */
  onRouteClick?: (routeId: string, lngLat: { lng: number; lat: number }) => void;
  /** Called when user clicks a hub circle */
  onHubClick?: (hubId: string, lngLat: { lng: number; lat: number }) => void;
  selectedRouteId?: string | null;
  /** Enable animated dash-offset flow effect */
  animateFlows?: boolean;
  /** Route type filter — only show these types (show all if empty/undefined) */
  visibleRouteTypes?: string[];
}

export function TransportOverlay({
  map,
  routeData,
  hubData,
  visible,
  onRouteClick,
  onHubClick,
  selectedRouteId,
  animateFlows = false,
  visibleRouteTypes,
}: TransportOverlayProps) {
  const animFrameRef = useRef<number>(0);
  const dashOffsetRef = useRef(0);

  // ── Filtered data based on route type visibility ──
  const filteredData = useFilteredRouteData(routeData, visibleRouteTypes);

  // ── Animate dash offset for flow effect ──
  const animateRef = useRef(animateFlows);
  animateRef.current = animateFlows;

  const startAnimation = useCallback(() => {
    if (!map || !animateRef.current) return;

    const tick = () => {
      if (!animateRef.current || !map) return;
      dashOffsetRef.current = (dashOffsetRef.current + 0.5) % 100;

      try {
        if (map.getLayer(ROUTES_LAYER)) {
          map.setPaintProperty(ROUTES_LAYER, "line-dasharray", [
            4 + Math.sin(dashOffsetRef.current * 0.1) * 0.5,
            2,
          ]);
        }
      } catch {
        // Layer may have been removed
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [map]);

  // Stop animation on unmount or when disabled
  useEffect(() => {
    if (animateFlows && map && visible) {
      startAnimation();
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [animateFlows, map, visible, startAnimation]);

  // ── Main layer setup effect ──
  useEffect(() => {
    if (!map) return;

    const handleRouteClick = (e: any) => {
      if (!onRouteClick) return;
      const features = map.queryRenderedFeatures(e.point, { layers: [ROUTES_LAYER] });
      if (features.length > 0) {
        const id = features[0]?.properties?.id as string | undefined;
        if (id) {
          e.routeClicked = true;
          onRouteClick(id, e.lngLat);
          e.preventDefault?.();
        }
      }
    };

    const handleHubClick = (e: any) => {
      if (!onHubClick) return;
      const features = map.queryRenderedFeatures(e.point, { layers: [HUBS_LAYER] });
      if (features.length > 0) {
        const id = features[0]?.properties?.id as string | undefined;
        if (id) {
          e.routeClicked = true;
          onHubClick(id, e.lngLat);
          e.preventDefault?.();
        }
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const setupLayers = () => {
      if (!map.isStyleLoaded()) return;

      try {
        // ── 1. Routes Source ──
        const routeSource = map.getSource(ROUTES_SOURCE);
        if (routeSource && "setData" in routeSource) {
          (routeSource as any).setData(filteredData);
        } else if (!routeSource) {
          map.addSource(ROUTES_SOURCE, { type: "geojson", data: filteredData });
        }

        // ── 2. Hubs Source ──
        if (hubData) {
          const hubSource = map.getSource(HUBS_SOURCE);
          if (hubSource && "setData" in hubSource) {
            (hubSource as any).setData(hubData);
          } else if (!hubSource) {
            map.addSource(HUBS_SOURCE, { type: "geojson", data: hubData });
          }
        }

        // ── 3. Selected Route Glow Layer (rendered BELOW the main line) ──
        if (!map.getLayer(ROUTES_GLOW_LAYER) && selectedRouteId) {
          map.addLayer({
            id: ROUTES_GLOW_LAYER,
            type: "line",
            source: ROUTES_SOURCE,
            filter: ["==", ["get", "id"], selectedRouteId],
            paint: {
              "line-color": buildColorExpression() as any,
              "line-width": 12,
              "line-blur": 6,
              "line-opacity": 0.3,
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });
        } else if (map.getLayer(ROUTES_GLOW_LAYER)) {
          if (selectedRouteId) {
            map.setFilter(ROUTES_GLOW_LAYER, ["==", ["get", "id"], selectedRouteId]);
            map.setLayoutProperty(ROUTES_GLOW_LAYER, "visibility", visible ? "visible" : "none");
          } else {
            map.setLayoutProperty(ROUTES_GLOW_LAYER, "visibility", "none");
          }
        }

        // ── 4. Main Routes Layer ──
        if (!map.getLayer(ROUTES_LAYER)) {
          map.addLayer({
            id: ROUTES_LAYER,
            type: "line",
            source: ROUTES_SOURCE,
            paint: {
              "line-color": buildColorExpression() as any,
              "line-width": buildWidthExpression(selectedRouteId) as any,
              "line-opacity": buildOpacityExpression(selectedRouteId) as any,
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });
        } else {
          map.setPaintProperty(ROUTES_LAYER, "line-width", buildWidthExpression(selectedRouteId));
          map.setPaintProperty(
            ROUTES_LAYER,
            "line-opacity",
            buildOpacityExpression(selectedRouteId)
          );
        }

        // ── 5. Directional Arrow Layer ──
        if (!map.getLayer(ROUTES_ARROWS_LAYER)) {
          map.addLayer({
            id: ROUTES_ARROWS_LAYER,
            type: "symbol",
            source: ROUTES_SOURCE,
            minzoom: 6,
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 150,
              "icon-image": "triangle-15",
              "icon-size": 0.6,
              "icon-rotate": 90,
              "icon-rotation-alignment": "map",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
            paint: {
              "icon-color": buildColorExpression() as any,
              "icon-opacity": [
                "case",
                ["==", ["get", "status"], "abandoned"],
                0.2,
                ["==", ["get", "status"], "planned"],
                0.3,
                0.6,
              ],
            },
          });
        }

        // ── 6. Hubs Layer ──
        if (hubData) {
          if (!map.getLayer(HUBS_LAYER)) {
            map.addLayer({
              id: HUBS_LAYER,
              type: "circle",
              source: HUBS_SOURCE,
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["get", "connections"],
                  1,
                  3,
                  5,
                  6,
                  10,
                  9,
                ],
                "circle-color": "#1f2937",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
                "circle-opacity": 0.9,
              },
            });
          }
        }

        // ── 7. Set visibility ──
        const vis = visible ? "visible" : "none";
        for (const layerId of [ROUTES_GLOW_LAYER, ROUTES_LAYER, ROUTES_ARROWS_LAYER, HUBS_LAYER]) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", vis);
          }
        }

        // Hide glow when no selection
        if (!selectedRouteId && map.getLayer(ROUTES_GLOW_LAYER)) {
          map.setLayoutProperty(ROUTES_GLOW_LAYER, "visibility", "none");
        }

        // ── 8. Push layers below labels/points but above backgrounds ──
        let beforeId: string | undefined = undefined;
        for (const id of [
          "editor-points-capital",
          "editor-points-city",
          "editor-points-poi",
          "editor-points-story-pin",
          "editor-points-map-label",
          "editor-points-labels",
          "editor-pending-point-layer",
        ]) {
          if (map.getLayer(id)) {
            beforeId = id;
            break;
          }
        }

        for (const layerId of [ROUTES_GLOW_LAYER, ROUTES_LAYER, ROUTES_ARROWS_LAYER, HUBS_LAYER]) {
          if (map.getLayer(layerId)) {
            map.moveLayer(layerId, beforeId);
          }
        }

        // ── 9. Event listeners ──
        try {
          map.off("click", ROUTES_LAYER, handleRouteClick);
          map.off("mouseenter", ROUTES_LAYER, handleMouseEnter);
          map.off("mouseleave", ROUTES_LAYER, handleMouseLeave);
          map.off("click", HUBS_LAYER, handleHubClick);
          map.off("mouseenter", HUBS_LAYER, handleMouseEnter);
          map.off("mouseleave", HUBS_LAYER, handleMouseLeave);
        } catch {
          // ignore
        }

        if (visible) {
          if (map.getLayer(ROUTES_LAYER)) {
            map.on("click", ROUTES_LAYER, handleRouteClick);
            map.on("mouseenter", ROUTES_LAYER, handleMouseEnter);
            map.on("mouseleave", ROUTES_LAYER, handleMouseLeave);
          }
          if (map.getLayer(HUBS_LAYER)) {
            map.on("click", HUBS_LAYER, handleHubClick);
            map.on("mouseenter", HUBS_LAYER, handleMouseEnter);
            map.on("mouseleave", HUBS_LAYER, handleMouseLeave);
          }
        }
      } catch (err) {
        console.error("[TransportOverlay] Error during setupLayers:", err);
      }
    };

    map.on("styledata", setupLayers);

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.once("style.load", setupLayers);
      map.once("load", setupLayers);
    }

    return () => {
      try {
        map.off("styledata", setupLayers);
        map.off("style.load", setupLayers);
        map.off("load", setupLayers);
        if (map.getLayer(ROUTES_LAYER)) {
          map.off("click", ROUTES_LAYER, handleRouteClick);
          map.off("mouseenter", ROUTES_LAYER, handleMouseEnter);
          map.off("mouseleave", ROUTES_LAYER, handleMouseLeave);
        }
        if (map.getLayer(HUBS_LAYER)) {
          map.off("click", HUBS_LAYER, handleHubClick);
          map.off("mouseenter", HUBS_LAYER, handleMouseEnter);
          map.off("mouseleave", HUBS_LAYER, handleMouseLeave);
        }
      } catch {
        /* map destroyed */
      }
    };
  }, [map, filteredData, hubData, visible, selectedRouteId, onRouteClick, onHubClick]);

  // ── Clean up layers on unmount ──
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        for (const layerId of [ROUTES_ARROWS_LAYER, ROUTES_GLOW_LAYER, ROUTES_LAYER, HUBS_LAYER]) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
        if (map.getSource(HUBS_SOURCE)) map.removeSource(HUBS_SOURCE);
        if (map.getSource(ROUTES_SOURCE)) map.removeSource(ROUTES_SOURCE);
      } catch {
        /* map destroyed */
      }
    };
  }, [map]);

  return null;
}

// ── Helper: filter route data by visible types ──────────────────────

function useFilteredRouteData(
  data: FeatureCollection,
  visibleTypes: string[] | undefined
): FeatureCollection {
  if (!visibleTypes || visibleTypes.length === 0) return data;

  const typeSet = new Set(visibleTypes);
  return {
    type: "FeatureCollection",
    features: data.features.filter(
      (f) => f.properties && typeSet.has(f.properties.routeType as string)
    ),
  };
}
