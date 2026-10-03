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
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { LazyDeckTransportOverlay } from "~/components/maps/overlays/LazyDeckTransportOverlay";
import { isMapStyleReady } from "~/lib/maps/geojson-layer-helpers";
import {
  featuresToSegments,
  calculateNetworkAverageEconomicCoefficient,
  type GeoJSONCollectionLike,
} from "~/lib/maps/transport-vehicle-sim";
import {
  ALL_ROUTE_LAYERS,
  HUBS_LAYER,
  ROUTES_FLOW_LAYER,
  addTransportLayers,
  applyRouteSelection,
  applyTransportVisibility,
  buildFlowDashArray,
  createFeatureClickHandler,
  filterRouteData,
  hasAllTransportLayers,
  removeTransportLayers,
  setTransportEvents,
  syncTransportSources,
} from "./transport-layers";

interface TransportOverlayProps {
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

  const filteredData = useMemo(
    () => filterRouteData(routeData, visibleRouteTypes, maxBuiltYear),
    [routeData, visibleRouteTypes, maxBuiltYear]
  );

  const deckSegments = useMemo(
    () => (enableDeckGl ? featuresToSegments(filteredData as GeoJSONCollectionLike) : []),
    [enableDeckGl, filteredData]
  );
  const networkEconCoeff = useMemo(
    () => calculateNetworkAverageEconomicCoefficient(deckSegments),
    [deckSegments]
  );

  // Latest props for long-lived map listeners and the animation loop.
  const latest = useRef({
    filteredData,
    onRouteClick,
    onHubClick,
    selectedRouteId,
    visible,
    animateFlows,
  });
  latest.current = {
    filteredData,
    onRouteClick,
    onHubClick,
    selectedRouteId,
    visible,
    animateFlows,
  };

  const startAnimation = useCallback(() => {
    if (!map || !latest.current.animateFlows) return;

    let lastTime = 0;
    const tick = (now: number) => {
      if (!latest.current.animateFlows) return;

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

  const hoverCountRef = useRef(0);
  const handleMouseEnter = useCallback(() => {
    hoverCountRef.current++;
    if (map) map.getCanvas().style.cursor = "pointer";
  }, [map]);

  const handleMouseLeave = useCallback(() => {
    hoverCountRef.current = Math.max(0, hoverCountRef.current - 1);
    if (hoverCountRef.current === 0 && map) map.getCanvas().style.cursor = "";
  }, [map]);

  // Layer lifecycle and event binding (re-run on every style load)
  useEffect(() => {
    if (!map) return;

    const handlers = {
      onRouteClick: createFeatureClickHandler(
        map,
        ALL_ROUTE_LAYERS,
        () => latest.current.onRouteClick
      ),
      onHubClick: createFeatureClickHandler(map, [HUBS_LAYER], () => latest.current.onHubClick),
      onEnter: handleMouseEnter,
      onLeave: handleMouseLeave,
    };

    // Runs on every `styledata` event, which MapLibre fires after any style change. It must be
    // a no-op when all layers already exist: it used to call moveLayer() unconditionally, and
    // every moveLayer is itself a style change, so the map re-rendered in an endless
    // styledata → moveLayer loop for as long as the transport overlay was mounted.
    let eventsBound = false;
    const setupLayers = () => {
      if (!isMapStyleReady(map)) return;
      if (hasAllTransportLayers(map, !!hubData)) {
        if (!eventsBound) {
          setTransportEvents(map, handlers, true);
          eventsBound = true;
        }
        return;
      }

      try {
        const { filteredData: routes, visible, animateFlows, selectedRouteId } = latest.current;
        addTransportLayers(map, {
          routeData: routes,
          hubData,
          visible,
          animateFlows,
          selectedRouteId,
        });
        setTransportEvents(map, handlers, false);
        setTransportEvents(map, handlers, true);
        eventsBound = true;
      } catch (err) {
        console.error("[TransportOverlay] Error during setupLayers:", err);
      }
    };

    map.on("styledata", setupLayers);
    if (isMapStyleReady(map)) {
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
        setTransportEvents(map, handlers, false);
      } catch {
        /* map destroyed */
      }
    };
  }, [map, handleMouseEnter, handleMouseLeave]);

  // Only update the GeoJSON sources when the data actually changes
  const prevDataRef = useRef<{ routes: FeatureCollection | null; hubs: FeatureCollection | null }>({
    routes: null,
    hubs: null,
  });
  useEffect(() => {
    if (!isMapStyleReady(map)) return;
    try {
      syncTransportSources(map, filteredData, hubData, prevDataRef.current);
    } catch {
      // Source update safely ignored
    }
  }, [map, filteredData, hubData]);

  useEffect(() => {
    if (!isMapStyleReady(map)) return;
    try {
      applyRouteSelection(map, selectedRouteId, visible);
    } catch {
      // Layer paint property update safely ignored
    }
  }, [map, selectedRouteId, visible]);

  useEffect(() => {
    if (!isMapStyleReady(map)) return;
    try {
      applyTransportVisibility(map, { visible, selectedRouteId, animateFlows });
    } catch {
      // Visibility update safely ignored
    }
  }, [map, visible, selectedRouteId, animateFlows]);

  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        removeTransportLayers(map);
      } catch {
        /* map destroyed */
      }
    };
  }, [map]);

  if (!enableDeckGl) return null;
  return (
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
  );
}
