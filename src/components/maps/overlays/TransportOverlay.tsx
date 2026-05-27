"use client";

/**
 * TransportOverlay — Renders transport routes on the map.
 *
 * Uses MapLibre line layers with data-driven styling:
 * - Rail: solid thick lines (dark gray)
 * - Highway: solid medium lines (orange)
 * - Road: thin dashed lines (brown)
 * - Shipping: dotted blue lines
 * - Canal: thin cyan lines
 *
 * Also renders transport hubs as circle markers.
 */

import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

const ROUTES_SOURCE = "transport-routes-source";
const ROUTES_LAYER = "transport-routes-line";
const HUBS_SOURCE = "transport-hubs-source";
const HUBS_LAYER = "transport-hubs-circle";

const ROUTE_COLORS: Record<string, string> = {
  rail: "#374151", // gray-700
  highway: "#f97316", // orange-500
  road: "#92400e", // amber-800
  shipping_lane: "#3b82f6", // blue-500
  canal: "#06b6d4", // cyan-500
};

const ROUTE_WIDTHS: Record<string, number> = {
  rail: 3,
  highway: 2.5,
  road: 1.5,
  shipping_lane: 2,
  canal: 1.5,
};

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
}

export function TransportOverlay({
  map,
  routeData,
  hubData,
  visible,
  onRouteClick,
  onHubClick,
  selectedRouteId,
}: TransportOverlayProps) {
  useEffect(() => {
    if (!map) return;

    // Define handlers inside the effect so they close over latest props/callbacks
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
        // 1. Routes Source
        const routeSource = map.getSource(ROUTES_SOURCE);
        if (routeSource && "setData" in routeSource) {
          (routeSource as any).setData(routeData);
        } else if (!routeSource) {
          map.addSource(ROUTES_SOURCE, { type: "geojson", data: routeData });
        }

        // 2. Hubs Source
        if (hubData) {
          const hubSource = map.getSource(HUBS_SOURCE);
          if (hubSource && "setData" in hubSource) {
            (hubSource as any).setData(hubData);
          } else if (!hubSource) {
            map.addSource(HUBS_SOURCE, { type: "geojson", data: hubData });
          }
        }

        // 3. Routes Layer
        if (!map.getLayer(ROUTES_LAYER)) {
          map.addLayer({
            id: ROUTES_LAYER,
            type: "line",
            source: ROUTES_SOURCE,
            paint: {
              "line-color": [
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
                "#888888", // fallback
              ],
              "line-width": [
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
                  1.5, // fallback
                ],
              ],
              "line-opacity": [
                "case",
                ["==", ["get", "id"], selectedRouteId ?? ""],
                1.0,
                selectedRouteId ? 0.35 : 0.8,
              ],
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });
        } else {
          // If layer already exists, update paint properties to align with latest state
          map.setPaintProperty(ROUTES_LAYER, "line-width", [
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
              1.5,
            ],
          ]);
          map.setPaintProperty(ROUTES_LAYER, "line-opacity", [
            "case",
            ["==", ["get", "id"], selectedRouteId ?? ""],
            1.0,
            selectedRouteId ? 0.35 : 0.8,
          ]);
        }

        // 4. Hubs Layer
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
                "circle-stroke-width": 1,
                "circle-opacity": 0.9,
              },
            });
          }
        }

        // 5. Set visibility
        const vis = visible ? "visible" : "none";
        if (map.getLayer(ROUTES_LAYER)) {
          map.setLayoutProperty(ROUTES_LAYER, "visibility", vis);
        }
        if (map.getLayer(HUBS_LAYER)) {
          map.setLayoutProperty(HUBS_LAYER, "visibility", vis);
        }

        // 6. Push layers below labels/points but above backgrounds
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

        if (map.getLayer(ROUTES_LAYER)) {
          map.moveLayer(ROUTES_LAYER, beforeId);
        }
        if (map.getLayer(HUBS_LAYER)) {
          map.moveLayer(HUBS_LAYER, beforeId);
        }

        // 7. Event listeners bind/unbind
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
  }, [map, routeData, hubData, visible, selectedRouteId, onRouteClick, onHubClick]);

  // Clean up layers when overlay component unmounts completely
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(HUBS_LAYER)) map.removeLayer(HUBS_LAYER);
        if (map.getLayer(ROUTES_LAYER)) map.removeLayer(ROUTES_LAYER);
        if (map.getSource(HUBS_SOURCE)) map.removeSource(HUBS_SOURCE);
        if (map.getSource(ROUTES_SOURCE)) map.removeSource(ROUTES_SOURCE);
      } catch {
        /* map destroyed */
      }
    };
  }, [map]);

  return null;
}
