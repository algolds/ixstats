"use client";

/**
 * TransportOverlay — Renders transport routes on the map with rich visual styling.
 *
 * Visual features:
 * - Data-driven dash patterns per route type (solid, dashed air/ferry)
 * - Zoom-dependent visibility tiers (Strategic z0, Regional z4, Infrastructure z6)
 * - Hub type visual differentiation with dynamic zoom-scaled radius
 * - Directional arrow symbols along routes (zoom ≥ 6)
 * - Selected route glow effect (wide blurred halo)
 * - International route visual underlay accent
 * - Status-based opacity (planned=40%, construction=70%, operational=100%, abandoned=30%)
 * - Animated directional dash-offset flow effect (performance-capped at 30 FPS)
 * - Color-coded by all 18 route types (rail, road, maritime, air, utility, military)
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import type { Map as MapLibreMap, GeoJSONSource, MapLayerMouseEvent, ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { ROUTE_STYLES, ROUTE_COLORS } from "~/lib/maps/map-config";
import { LazyDeckTransportOverlay } from "~/components/maps/overlays/LazyDeckTransportOverlay";
import {
  featuresToSegments,
  calculateNetworkAverageEconomicCoefficient,
  type GeoJSONCollectionLike,
} from "~/lib/maps/transport-vehicle-sim";
export { ROUTE_COLORS };

// ── Layer / Source IDs ──────────────────────────────────────────────

const ROUTES_SOURCE = "transport-routes-source";
const ROUTES_INTERNATIONAL_LAYER = "transport-routes-international";
const ROUTES_GLOW_LAYER = "transport-routes-glow";
const ROUTES_SOLID_TIER0 = "transport-routes-solid-tier0";
const ROUTES_SOLID_TIER4 = "transport-routes-solid-tier4";
const ROUTES_SOLID_TIER6 = "transport-routes-solid-tier6";
const ROUTES_DASHED_AIR = "transport-routes-dashed-air";
const ROUTES_DASHED_FERRY = "transport-routes-dashed-ferry";
const ROUTES_FLOW_LAYER = "transport-routes-flow";
const ROUTES_ARROWS_LAYER = "transport-routes-arrows";
const HUBS_SOURCE = "transport-hubs-source";
const HUBS_LAYER = "transport-hubs-circle";

/** Primary route layer for backwards-compatibility queries */
export const ROUTES_LAYER = ROUTES_SOLID_TIER0;

const ALL_ROUTE_LAYERS = [
  ROUTES_SOLID_TIER0,
  ROUTES_SOLID_TIER4,
  ROUTES_SOLID_TIER6,
  ROUTES_DASHED_AIR,
  ROUTES_DASHED_FERRY,
];

const ALL_TRANSPORT_LAYERS = [
  ROUTES_INTERNATIONAL_LAYER,
  ROUTES_GLOW_LAYER,
  ...ALL_ROUTE_LAYERS,
  ROUTES_FLOW_LAYER,
  ROUTES_ARROWS_LAYER,
  HUBS_LAYER,
];

// ── Color & Width Config — derived from ROUTE_STYLES ────────────────

const ROUTE_WIDTHS: Record<string, number> = Object.fromEntries(
  Object.entries(ROUTE_STYLES).map(([k, v]) => [k, v.width])
);

const HUB_COLORS: Record<string, string> = {
  station: "#64748b",
  port: "#3b82f6",
  airport: "#a855f7",
  junction: "#f59e0b",
  interchange: "#ef4444",
};

const TIER0_TYPES = ["rail", "high_speed_rail", "highway", "motorway", "shipping_lane"];
const TIER4_TYPES = ["road", "trunk", "canal", "military_supply", "military_naval"];
const TIER6_TYPES = ["secondary", "pipeline", "power_grid", "fiber", "freight_rail", "commuter_rail"];

const STATUS_OPACITY: Record<string, number> = {
  planned: 0.4,
  under_construction: 0.7,
  operational: 1.0,
  abandoned: 0.3,
};

// ── MapLibre Expressions ────────────────────────────────────────────

function buildColorExpression(): ExpressionSpecification {
  const arms: (string | number | boolean | ExpressionSpecification)[] = ["match", ["get", "routeType"]];
  for (const [type, color] of Object.entries(ROUTE_COLORS)) {
    arms.push(type, color);
  }
  arms.push("#888888");
  return arms as ExpressionSpecification;
}

function buildTypeWidthExpression(): ExpressionSpecification {
  const arms: (string | number | boolean | ExpressionSpecification)[] = ["match", ["get", "routeType"]];
  for (const [type, width] of Object.entries(ROUTE_WIDTHS)) {
    arms.push(type, width);
  }
  arms.push(1.5);
  return arms as ExpressionSpecification;
}

function buildWidthExpression(selectedRouteId: string | null | undefined): ExpressionSpecification {
  return ["case", ["==", ["get", "id"], selectedRouteId ?? ""], 6, buildTypeWidthExpression()] as ExpressionSpecification;
}

function buildOpacityExpression(selectedRouteId: string | null | undefined): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "id"], selectedRouteId ?? ""],
    1.0,
    selectedRouteId
      ? [
          "match",
          ["get", "status"],
          "planned", 0.2,
          "under_construction", 0.35,
          "operational", 0.35,
          "abandoned", 0.15,
          0.35,
        ]
      : [
          "match",
          ["get", "status"],
          "planned", STATUS_OPACITY.planned!,
          "under_construction", STATUS_OPACITY.under_construction!,
          "operational", STATUS_OPACITY.operational!,
          "abandoned", STATUS_OPACITY.abandoned!,
          0.8,
        ],
  ] as ExpressionSpecification;
}

function buildHubColorExpression(): ExpressionSpecification {
  const arms: (string | number | boolean | ExpressionSpecification)[] = ["match", ["get", "hubType"]];
  for (const [type, color] of Object.entries(HUB_COLORS)) {
    arms.push(type, color);
  }
  arms.push("#64748b");
  return arms as ExpressionSpecification;
}

const HUB_RADIUS_EXPRESSION: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2,
  ["interpolate", ["linear"], ["coalesce", ["get", "connections"], 1], 1, 2.5, 5, 4.5, 10, 6.5],
  8,
  ["interpolate", ["linear"], ["coalesce", ["get", "connections"], 1], 1, 4.5, 5, 7.5, 10, 11],
  14,
  ["interpolate", ["linear"], ["coalesce", ["get", "connections"], 1], 1, 7, 5, 12, 10, 18],
];

function buildFlowDashArray(offset: number): [number, number, number, number] {
  const dash = 6;
  const gap = 4;
  const period = dash + gap;
  const s = ((offset % period) + period) % period;

  if (s < dash) {
    return [Math.max(0.01, dash - s), gap, Math.max(0.01, s), 0.01];
  }
  const u = s - dash;
  return [0.01, Math.max(0.01, gap - u), dash, Math.max(0.01, u)];
}

interface RouteLayerConfig {
  id: string;
  minzoom: number;
  filter: ExpressionSpecification;
  dash?: [number, number];
}

const ROUTE_LAYER_CONFIGS: RouteLayerConfig[] = [
  { id: ROUTES_SOLID_TIER0, minzoom: 0, filter: ["in", ["get", "routeType"], ["literal", TIER0_TYPES]] },
  { id: ROUTES_SOLID_TIER4, minzoom: 4, filter: ["in", ["get", "routeType"], ["literal", TIER4_TYPES]] },
  { id: ROUTES_SOLID_TIER6, minzoom: 6, filter: ["in", ["get", "routeType"], ["literal", TIER6_TYPES]] },
  { id: ROUTES_DASHED_AIR, minzoom: 0, filter: ["==", ["get", "routeType"], "air_corridor"], dash: [6, 4] },
  { id: ROUTES_DASHED_FERRY, minzoom: 4, filter: ["==", ["get", "routeType"], "ferry"], dash: [4, 3] },
];

// ── Component ───────────────────────────────────────────────────────

export interface TransportOverlayProps {
  map: MapLibreMap | null;
  routeData: FeatureCollection;
  hubData?: FeatureCollection;
  visible: boolean;
  onRouteClick?: (routeId: string, lngLat: { lng: number; lat: number }) => void;
  onHubClick?: (hubId: string, lngLat: { lng: number; lat: number }) => void;
  selectedRouteId?: string | null;
  animateFlows?: boolean;
  visibleRouteTypes?: string[];
  maxBuiltYear?: number | null;
  enableDeckGl?: boolean;
  enableFlightArcs?: boolean;
  enableGpuTrips?: boolean;
  enableHubPillars?: boolean;
  speedMultiplier?: number;
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
  maxBuiltYear,
  enableDeckGl = true,
  enableFlightArcs = true,
  enableGpuTrips = true,
  enableHubPillars = true,
  speedMultiplier = 1,
}: TransportOverlayProps) {
  const animFrameRef = useRef<number>(0);
  const dashOffsetRef = useRef(0);

  const filteredData = useFilteredRouteData(routeData, visibleRouteTypes, maxBuiltYear);

  const deckSegments = useMemo(() => {
    if (!enableDeckGl) return [];
    return featuresToSegments(filteredData as GeoJSONCollectionLike);
  }, [enableDeckGl, filteredData]);

  const networkEconCoeff = useMemo(() => {
    return calculateNetworkAverageEconomicCoefficient(deckSegments);
  }, [deckSegments]);

  const animateRef = useRef(animateFlows);
  animateRef.current = animateFlows;

  const startAnimation = useCallback(() => {
    if (!map || !animateRef.current) return;

    let lastTime = 0;
    const tick = (now: number) => {
      if (!animateRef.current || !map) return;

      if (now - lastTime >= 32) {
        lastTime = now;
        const advanceRate = 0.25 * networkEconCoeff * speedMultiplier;
        dashOffsetRef.current = (dashOffsetRef.current + advanceRate) % 100;

        try {
          if (map.getLayer(ROUTES_FLOW_LAYER)) {
            map.setPaintProperty(
              ROUTES_FLOW_LAYER,
              "line-dasharray",
              buildFlowDashArray(dashOffsetRef.current)
            );
          }
        } catch {
          // Layer may have been removed
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [map, networkEconCoeff, speedMultiplier]);

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

  const onRouteClickRef = useRef(onRouteClick);
  onRouteClickRef.current = onRouteClick;

  const onHubClickRef = useRef(onHubClick);
  onHubClickRef.current = onHubClick;

  const selectedRouteIdRef = useRef(selectedRouteId);
  selectedRouteIdRef.current = selectedRouteId;

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const animateFlowsRef = useRef(animateFlows);
  animateFlowsRef.current = animateFlows;

  const hoverCountRef = useRef(0);
  const handleMouseEnter = useCallback(() => {
    hoverCountRef.current++;
    if (map) {
      map.getCanvas().style.cursor = "pointer";
    }
  }, [map]);

  const handleMouseLeave = useCallback(() => {
    hoverCountRef.current = Math.max(0, hoverCountRef.current - 1);
    if (hoverCountRef.current === 0 && map) {
      map.getCanvas().style.cursor = "";
    }
  }, [map]);

  // ── 1. Layer Lifecycle & Event Binding (Run strictly on map style load) ──
  useEffect(() => {
    if (!map) return;

    const handleRouteClick = (e: MapLayerMouseEvent) => {
      if (!onRouteClickRef.current) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ALL_ROUTE_LAYERS });
      if (features.length > 0) {
        const id = features[0]?.properties?.id as string | undefined;
        if (id) {
          (e.originalEvent as MouseEvent & { routeClicked?: boolean }).routeClicked = true;
          (e as MapLayerMouseEvent & { routeClicked?: boolean }).routeClicked = true;
          onRouteClickRef.current(id, e.lngLat);
          e.preventDefault?.();
        }
      }
    };

    const handleHubClick = (e: MapLayerMouseEvent) => {
      if (!onHubClickRef.current) return;
      const features = map.queryRenderedFeatures(e.point, { layers: [HUBS_LAYER] });
      if (features.length > 0) {
        const id = features[0]?.properties?.id as string | undefined;
        if (id) {
          (e.originalEvent as MouseEvent & { routeClicked?: boolean }).routeClicked = true;
          (e as MapLayerMouseEvent & { routeClicked?: boolean }).routeClicked = true;
          onHubClickRef.current(id, e.lngLat);
          e.preventDefault?.();
        }
      }
    };

    const bindLayerEvents = (bind: boolean) => {
      if (bind) {
        for (const layerId of ALL_ROUTE_LAYERS) {
          if (map.getLayer(layerId)) {
            map.on("click", layerId, handleRouteClick);
            map.on("mouseenter", layerId, handleMouseEnter);
            map.on("mouseleave", layerId, handleMouseLeave);
          }
        }
        if (map.getLayer(HUBS_LAYER)) {
          map.on("click", HUBS_LAYER, handleHubClick);
          map.on("mouseenter", HUBS_LAYER, handleMouseEnter);
          map.on("mouseleave", HUBS_LAYER, handleMouseLeave);
        }
      } else {
        for (const layerId of ALL_ROUTE_LAYERS) {
          map.off("click", layerId, handleRouteClick);
          map.off("mouseenter", layerId, handleMouseEnter);
          map.off("mouseleave", layerId, handleMouseLeave);
        }
        map.off("click", HUBS_LAYER, handleHubClick);
        map.off("mouseenter", HUBS_LAYER, handleMouseEnter);
        map.off("mouseleave", HUBS_LAYER, handleMouseLeave);
      }
    };

    const setupLayers = () => {
      if (!map.isStyleLoaded()) return;

      try {
        // 1. Sources
        if (!map.getSource(ROUTES_SOURCE)) {
          map.addSource(ROUTES_SOURCE, { type: "geojson", data: filteredData });
        }
        if (hubData && !map.getSource(HUBS_SOURCE)) {
          map.addSource(HUBS_SOURCE, { type: "geojson", data: hubData });
        }

        // 2. International Underlay
        if (!map.getLayer(ROUTES_INTERNATIONAL_LAYER)) {
          map.addLayer({
            id: ROUTES_INTERNATIONAL_LAYER,
            type: "line",
            source: ROUTES_SOURCE,
            filter: ["==", ["get", "isInternational"], true],
            paint: {
              "line-color": "#38bdf8",
              "line-width": ["+", buildTypeWidthExpression(), 3],
              "line-opacity": 0.4,
              "line-blur": 1.5,
            },
            layout: { "line-cap": "round", "line-join": "round", visibility: visibleRef.current ? "visible" : "none" },
          });
        }

        // 3. Glow Layer
        if (!map.getLayer(ROUTES_GLOW_LAYER)) {
          map.addLayer({
            id: ROUTES_GLOW_LAYER,
            type: "line",
            source: ROUTES_SOURCE,
            filter: ["==", ["get", "id"], selectedRouteIdRef.current ?? ""],
            paint: { "line-color": buildColorExpression(), "line-width": 12, "line-blur": 6, "line-opacity": 0.35 },
            layout: { "line-cap": "round", "line-join": "round", visibility: visibleRef.current && selectedRouteIdRef.current ? "visible" : "none" },
          });
        }

        // 4. Main Route Layers
        for (const cfg of ROUTE_LAYER_CONFIGS) {
          if (!map.getLayer(cfg.id)) {
            const paint: Record<string, unknown> = {
              "line-color": buildColorExpression(),
              "line-width": buildWidthExpression(selectedRouteIdRef.current),
              "line-opacity": buildOpacityExpression(selectedRouteIdRef.current),
            };
            if (cfg.dash) paint["line-dasharray"] = cfg.dash;
            map.addLayer({
              id: cfg.id,
              type: "line",
              source: ROUTES_SOURCE,
              minzoom: cfg.minzoom,
              filter: cfg.filter,
              layout: { "line-cap": "round", "line-join": "round", visibility: visibleRef.current ? "visible" : "none" },
              paint: paint as Record<string, ExpressionSpecification | number[]>,
            });
          }
        }

        // 5. Flow Pulse Layer
        if (!map.getLayer(ROUTES_FLOW_LAYER)) {
          map.addLayer({
            id: ROUTES_FLOW_LAYER,
            type: "line",
            source: ROUTES_SOURCE,
            filter: ["==", ["get", "status"], "operational"],
            layout: {
              "line-cap": "round",
              "line-join": "round",
              visibility: visibleRef.current && animateFlowsRef.current ? "visible" : "none",
            },
            paint: {
              "line-color": "#ffffff",
              "line-width": buildTypeWidthExpression(),
              "line-opacity": 0.35,
              "line-dasharray": buildFlowDashArray(0),
            },
          });
        }

        // 6. Directional Arrows Layer
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
              "icon-color": buildColorExpression(),
              "icon-opacity": ["case", ["==", ["get", "status"], "abandoned"], 0.2, ["==", ["get", "status"], "planned"], 0.3, 0.6],
            },
          });
        }

        // 7. Hubs Layer
        if (hubData && !map.getLayer(HUBS_LAYER)) {
          map.addLayer({
            id: HUBS_LAYER,
            type: "circle",
            source: HUBS_SOURCE,
            paint: {
              "circle-radius": HUB_RADIUS_EXPRESSION,
              "circle-color": buildHubColorExpression(),
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.9,
            },
          });
        }

        // 8. Ordering
        let beforeId: string | undefined = undefined;
        for (const id of ["editor-points-capital", "editor-points-city", "editor-points-poi", "editor-points-labels", "editor-pending-point-layer"]) {
          if (map.getLayer(id)) {
            beforeId = id;
            break;
          }
        }
        for (const layerId of ALL_TRANSPORT_LAYERS) {
          if (map.getLayer(layerId)) map.moveLayer(layerId, beforeId);
        }

        // 9. Event Listeners
        bindLayerEvents(false);
        bindLayerEvents(true);
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
        bindLayerEvents(false);
      } catch {
        /* map destroyed */
      }
    };
  }, [map, handleMouseEnter, handleMouseLeave]);

  // ── 2. Data Synchronization (Only updates GeoJSON source when data actually changes) ──
  const prevDataRef = useRef<FeatureCollection | null>(null);
  const prevHubDataRef = useRef<FeatureCollection | null>(null);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    try {
      const routeSource = map.getSource(ROUTES_SOURCE) as GeoJSONSource | undefined;
      if (routeSource && "setData" in routeSource) {
        if (prevDataRef.current !== filteredData) {
          prevDataRef.current = filteredData;
          routeSource.setData(filteredData);
        }
      } else if (!routeSource) {
        map.addSource(ROUTES_SOURCE, { type: "geojson", data: filteredData });
        prevDataRef.current = filteredData;
      }

      if (hubData) {
        const hubSource = map.getSource(HUBS_SOURCE) as GeoJSONSource | undefined;
        if (hubSource && "setData" in hubSource) {
          if (prevHubDataRef.current !== hubData) {
            prevHubDataRef.current = hubData;
            hubSource.setData(hubData);
          }
        } else if (!hubSource) {
          map.addSource(HUBS_SOURCE, { type: "geojson", data: hubData });
          prevHubDataRef.current = hubData;
        }
      }
    } catch {
      // Source update safely ignored
    }
  }, [map, filteredData, hubData]);

  // ── 3. Dynamic Selection & Halo Glow (Pure GPU uniforms, ZERO WebGL tessellation) ──
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    try {
      if (map.getLayer(ROUTES_GLOW_LAYER)) {
        if (selectedRouteId) {
          map.setFilter(ROUTES_GLOW_LAYER, ["==", ["get", "id"], selectedRouteId]);
          map.setLayoutProperty(ROUTES_GLOW_LAYER, "visibility", visible ? "visible" : "none");
        } else {
          map.setLayoutProperty(ROUTES_GLOW_LAYER, "visibility", "none");
        }
      }

      for (const cfg of ROUTE_LAYER_CONFIGS) {
        if (map.getLayer(cfg.id)) {
          map.setPaintProperty(cfg.id, "line-width", buildWidthExpression(selectedRouteId));
          map.setPaintProperty(cfg.id, "line-opacity", buildOpacityExpression(selectedRouteId));
        }
      }
    } catch {
      // Layer paint property update safely ignored
    }
  }, [map, selectedRouteId, visible]);

  // ── 4. Visibility & Animation Toggle ──
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    const vis = visible ? "visible" : "none";
    try {
      for (const layerId of ALL_TRANSPORT_LAYERS) {
        if (!map.getLayer(layerId)) continue;
        if (layerId === ROUTES_GLOW_LAYER) {
          map.setLayoutProperty(layerId, "visibility", visible && selectedRouteId ? "visible" : "none");
        } else if (layerId === ROUTES_FLOW_LAYER) {
          map.setLayoutProperty(layerId, "visibility", visible && animateFlows ? "visible" : "none");
        } else {
          map.setLayoutProperty(layerId, "visibility", vis);
        }
      }
    } catch {
      // Visibility update safely ignored
    }
  }, [map, visible, selectedRouteId, animateFlows]);

  // Clean up layers on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        for (const layerId of ALL_TRANSPORT_LAYERS) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
        if (map.getSource(HUBS_SOURCE)) map.removeSource(HUBS_SOURCE);
        if (map.getSource(ROUTES_SOURCE)) map.removeSource(ROUTES_SOURCE);
      } catch {
        /* map destroyed */
      }
    };
  }, [map]);

  return (
    <>
      {enableDeckGl && (
        <LazyDeckTransportOverlay
          map={map}
          segments={deckSegments}
          visible={visible}
          enableFlightArcs={enableFlightArcs}
          enableGpuTrips={enableGpuTrips}
          enableHubPillars={enableHubPillars}
          speedMultiplier={speedMultiplier}
          selectedSegmentId={selectedRouteId}
          onSelectSegment={onRouteClick ? (id) => onRouteClick(id, { lng: 0, lat: 0 }) : undefined}
        />
      )}
    </>
  );
}

// ── Helper: filter route data by visible types ──────────────────────

function useFilteredRouteData(
  data: FeatureCollection,
  visibleTypes: string[] | undefined,
  maxBuiltYear?: number | null
): FeatureCollection {
  return useMemo(() => {
    const typeSet = visibleTypes && visibleTypes.length > 0 ? new Set(visibleTypes) : null;
    if (!typeSet && (maxBuiltYear === undefined || maxBuiltYear === null)) return data;
    return {
      type: "FeatureCollection",
      features: data.features.filter((f) => {
        if (!f.properties) return false;
        if (typeSet && !typeSet.has(f.properties.routeType as string)) return false;
        if (maxBuiltYear !== undefined && maxBuiltYear !== null) {
          const by = f.properties.builtYear;
          if (typeof by === "number" && by > maxBuiltYear) return false;
        }
        return true;
      }),
    };
  }, [data, visibleTypes, maxBuiltYear]);
}
