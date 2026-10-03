"use client";

/**
 * DeckTransportOverlay — High-performance deck.gl WebGL layer for transport networks.
 *
 * Capabilities:
 * - 3D Ballistic Flight Arcs (ArcLayer with greatCircle: true) for air corridors
 * - Pure GPU Vehicle Light Trails (TripsLayer) with customizable speed & trail decay
 * - 3D Volumetric Hub Pillars (ColumnLayer) visualizing logistics capacity & throughput
 * - Native MapLibre interleaved rendering (custom layer shared WebGL context)
 * - Projection-aware: gracefully suppresses 3D layers in low-zoom Globe mode to prevent Mercator clipping
 * - Facet Design System aesthetics: violet-cyan gradient arcs, frosted glass column pillars
 */

import { useEffect, useRef, useMemo, useCallback } from "react";
import type { Map as MapLibreMap, IControl as MapLibreControl } from "maplibre-gl";
import type { Layer } from "@deck.gl/core";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { ArcLayer, ColumnLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import {
  generateVehicleTrips,
  type TransportSegmentInput,
  type VehicleTrip,
} from "~/lib/maps/transport-vehicle-sim";
import {
  buildFlightArcs,
  buildHubPillars,
  type FlightArcData,
  type HubPillarData,
  type TransportNodeInput,
} from "./deck-transport-data";

export interface DeckTransportOverlayProps {
  map: MapLibreMap | null;
  segments: TransportSegmentInput[];
  nodes?: TransportNodeInput[];
  visible: boolean;
  enableFlightArcs?: boolean;
  enableGpuTrips?: boolean;
  enableHubPillars?: boolean;
  speedMultiplier?: number;
  selectedSegmentId?: string | null;
  onSelectSegment?: (segmentId: string) => void;
}

// ── Typed Control Adapter (MapLibre <-> MapboxOverlay) ───────────────

class DeckMapLibreAdapter implements MapLibreControl {
  private overlay: MapboxOverlay;

  constructor(props: MapboxOverlayProps) {
    this.overlay = new MapboxOverlay(props);
  }

  setProps(props: MapboxOverlayProps): void {
    this.overlay.setProps(props);
  }

  onAdd(map: MapLibreMap): HTMLElement {
    const el = this.overlay.onAdd(map);
    el.style.pointerEvents = "none";
    return el;
  }

  onRemove(_map: MapLibreMap): void {
    this.overlay.onRemove();
  }

  getDefaultPosition() {
    return this.overlay.getDefaultPosition();
  }

  finalize(): void {
    this.overlay.finalize();
  }
}

// ── Component ───────────────────────────────────────────────────────

export function DeckTransportOverlay({
  map,
  segments,
  nodes = [],
  visible,
  enableFlightArcs = true,
  enableGpuTrips = true,
  enableHubPillars = true,
  speedMultiplier = 1,
  selectedSegmentId,
  onSelectSegment,
}: DeckTransportOverlayProps) {
  const adapterRef = useRef<DeckMapLibreAdapter | null>(null);
  const animFrameRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const isGlobeModeRef = useRef<boolean>(false);

  const flightArcs = useMemo(
    () => (enableFlightArcs ? buildFlightArcs(segments) : []),
    [segments, enableFlightArcs]
  );

  const trips = useMemo<VehicleTrip[]>(() => {
    if (!enableGpuTrips || segments.length === 0) return [];
    return generateVehicleTrips(segments, 0.45, 120);
  }, [segments, enableGpuTrips]);

  const hubPillars = useMemo(
    () => (enableHubPillars ? buildHubPillars(nodes, segments, flightArcs) : []),
    [nodes, segments, flightArcs, enableHubPillars]
  );

  // 4. Layer builder (pure function)
  const buildDeckLayers = useCallback(
    (currentAnimTime: number): Layer[] => {
      if (!visible || isGlobeModeRef.current) {
        return [];
      }

      const layers: Layer[] = [];

      // ── ArcLayer: 3D Flight Corridors ──
      if (enableFlightArcs && flightArcs.length > 0) {
        layers.push(
          new ArcLayer<FlightArcData>({
            id: "deck-transport-flight-arcs",
            data: flightArcs,
            greatCircle: true,
            getSourcePosition: (d: FlightArcData) => d.source,
            getTargetPosition: (d: FlightArcData) => d.target,
            // Violet origin -> Sky Blue apex -> Violet destination
            getSourceColor: [168, 85, 247, 190],
            getTargetColor: [56, 189, 248, 220],
            getHeight: (d: FlightArcData) => d.height,
            getWidth: (d: FlightArcData) => (d.segmentId === selectedSegmentId ? 4 : 2),
            widthMinPixels: 1.5,
            pickable: false,
          })
        );
      }

      // ── TripsLayer: GPU Vehicle Light Trails ──
      if (enableGpuTrips && trips.length > 0) {
        layers.push(
          new TripsLayer<VehicleTrip>({
            id: "deck-transport-trips",
            data: trips,
            getPath: (d: VehicleTrip) => d.path,
            getTimestamps: (d: VehicleTrip) => d.timestamps,
            getColor: (d: VehicleTrip) => [...d.color, 240],
            opacity: 0.85,
            widthMinPixels: 3,
            rounded: true,
            trailLength: 60,
            currentTime: currentAnimTime,
            fadeTrail: true,
          })
        );
      }

      // ── ColumnLayer: 3D Volumetric Hub Pillars ──
      if (enableHubPillars && hubPillars.length > 0) {
        layers.push(
          new ColumnLayer<HubPillarData>({
            id: "deck-transport-hub-pillars",
            data: hubPillars,
            diskResolution: 14,
            radius: 5000,
            extruded: true,
            wireframe: true,
            stroked: true,
            getPosition: (d: HubPillarData) => [d.lng, d.lat],
            getElevation: (d: HubPillarData) => d.elevation,
            // Intermodal hubs glow with sky blue, airports with purple, ports with ocean blue
            getFillColor: (d: HubPillarData) =>
              d.isIntermodal
                ? [56, 189, 248, 175]
                : d.nodeType === "port"
                  ? [14, 165, 233, 140]
                  : d.nodeType === "airport"
                    ? [168, 85, 247, 140]
                    : [255, 255, 255, 120],
            getLineColor: (d: HubPillarData) =>
              d.isIntermodal ? [56, 189, 248, 255] : [255, 255, 255, 210],
            lineWidthMinPixels: 1.5,
            pickable: false,
          })
        );
      }

      return layers;
    },
    [
      visible,
      enableFlightArcs,
      flightArcs,
      enableGpuTrips,
      trips,
      enableHubPillars,
      hubPillars,
      selectedSegmentId,
      onSelectSegment,
    ]
  );

  const buildDeckLayersRef = useRef(buildDeckLayers);
  useEffect(() => {
    buildDeckLayersRef.current = buildDeckLayers;
  });

  // 5. Mount & Lifecycle management (mounted once per map instance)
  useEffect(() => {
    if (!map) return;

    let adapter = adapterRef.current;
    if (!adapter) {
      adapter = new DeckMapLibreAdapter({
        interleaved: false,
        layers: [],
      });
      adapterRef.current = adapter;
      map.addControl(adapter);
    }

    // Projection & Globe mode listener
    const updateProjectionGuard = () => {
      const zoom = map.getZoom();
      // MapLibre's globe mode at zoom < 4.5 uses spherical projection which clips Mercator WebGL shaders
      const isGlobe = zoom < 4.5;
      if (isGlobeModeRef.current !== isGlobe) {
        isGlobeModeRef.current = isGlobe;
        adapter?.setProps({ layers: buildDeckLayersRef.current(currentTimeRef.current) });
      }
    };

    map.on("zoom", updateProjectionGuard);
    updateProjectionGuard();

    return () => {
      map.off("zoom", updateProjectionGuard);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      if (adapterRef.current) {
        try {
          map.removeControl(adapterRef.current);
          adapterRef.current.finalize();
        } catch {
          // Map or control already detached
        }
        adapterRef.current = null;
      }
    };
  }, [map]);

  // 6. Static / Prop Update layer synchronization (when dynamic trip animation is idle)
  useEffect(() => {
    if (!adapterRef.current || !map) return;
    if (!visible || !enableGpuTrips || trips.length === 0) {
      adapterRef.current.setProps({ layers: buildDeckLayersRef.current(0) });
    }
  }, [map, visible, enableGpuTrips, trips.length, buildDeckLayers]);

  // 7. Animation Clock Loop for dynamic GPU trips (requestAnimationFrame capped at ~40 FPS)
  useEffect(() => {
    if (!map || !visible || !enableGpuTrips || trips.length === 0) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      return;
    }

    const loopDuration = 120; // Matches trip duration in vehicle sim
    let running = true;

    const tick = (now: number) => {
      if (!running) return;

      const elapsedMs = now - lastTickRef.current;
      // Cap rendering frequency to ~40 FPS (24ms) to protect GPU/battery
      if (elapsedMs >= 24) {
        const deltaSec = lastTickRef.current === 0 ? 0.024 : elapsedMs / 1000;
        lastTickRef.current = now;

        currentTimeRef.current =
          (currentTimeRef.current + deltaSec * speedMultiplier) % loopDuration;

        const layers = buildDeckLayersRef.current(currentTimeRef.current);
        adapterRef.current?.setProps({ layers });
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [map, visible, enableGpuTrips, trips.length, speedMultiplier]);

  return null;
}
