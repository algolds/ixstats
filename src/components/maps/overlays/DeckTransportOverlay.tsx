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

// ── Types ───────────────────────────────────────────────────────────

export interface TransportNodeInput {
  id: string;
  name?: string | null;
  nodeType?: string;
  coordinates: [number, number];
  elevation?: number | null;
  capacity?: number | null;
  connectedCount?: number;
}

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

interface FlightArcData {
  id: string;
  source: [number, number];
  target: [number, number];
  height: number;
  segmentId: string;
}

interface HubPillarData {
  id: string;
  name: string;
  lng: number;
  lat: number;
  elevation: number;
  nodeType: string;
  isIntermodal?: boolean;
}

// ── Math Helpers ────────────────────────────────────────────────────

function haversineDistKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const aVal =
    sinHalfLat * sinHalfLat +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      sinHalfLng *
      sinHalfLng;
  return 2 * R * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
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

  // 1. Prepare flight arcs from air_corridors
  const flightArcs = useMemo<FlightArcData[]>(() => {
    if (!enableFlightArcs) return [];
    const arcs: FlightArcData[] = [];

    for (const seg of segments) {
      if (seg.routeType !== "air_corridor") continue;
      const coords = seg.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const source = coords[0];
      const target = coords[coords.length - 1];
      if (!source || !target) continue;

      const dist = haversineDistKm(source, target);
      // Parabolic altitude scales with geographic flight distance (capped at 120km)
      const height = Math.min(dist * 120, 120000);

      arcs.push({
        id: `arc-${seg.id}`,
        source,
        target,
        height,
        segmentId: seg.id,
      });
    }

    return arcs;
  }, [segments, enableFlightArcs]);

  // 2. Prepare simulated trips for TripsLayer
  const trips = useMemo<VehicleTrip[]>(() => {
    if (!enableGpuTrips || segments.length === 0) return [];
    return generateVehicleTrips(segments, 0.45, 120);
  }, [segments, enableGpuTrips]);

  // 3. Prepare hub pillars from nodes or segment terminals with intermodal detection
  const hubPillars = useMemo<HubPillarData[]>(() => {
    if (!enableHubPillars) return [];

    // Detect intermodal multi-family convergence at nodes
    const intermodalNodeIds = new Set<string>();
    if (nodes.length > 0 && segments.length > 0) {
      const nodeModalTypes = new Map<string, Set<string>>();

      for (const seg of segments) {
        const coords = seg.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const p1 = coords[0]!;
        const p2 = coords[coords.length - 1]!;

        for (const n of nodes) {
          const d1 = Math.hypot(n.coordinates[0] - p1[0], n.coordinates[1] - p1[1]);
          const d2 = Math.hypot(n.coordinates[0] - p2[0], n.coordinates[1] - p2[1]);
          if (d1 < 0.02 || d2 < 0.02) {
            const set = nodeModalTypes.get(n.id) ?? new Set<string>();
            set.add(seg.routeType);
            nodeModalTypes.set(n.id, set);
          }
        }
      }

      for (const [nodeId, types] of nodeModalTypes.entries()) {
        const families = new Set<string>();
        for (const t of types) {
          if (t.includes("rail")) families.add("rail");
          else if (["shipping_lane", "canal", "ferry"].includes(t)) families.add("maritime");
          else if (t === "air_corridor") families.add("air");
          else if (["motorway", "highway", "trunk", "road", "secondary"].includes(t)) {
            families.add("road");
          }
        }
        if (families.size > 1) {
          intermodalNodeIds.add(nodeId);
        }
      }
    }

    if (nodes.length > 0) {
      return nodes.map((n) => {
        const isIntermodal = intermodalNodeIds.has(n.id);
        const baseElevation = n.capacity ?? (n.connectedCount ?? 3) * 1500;
        return {
          id: `hub-${n.id}`,
          name: n.name ?? (isIntermodal ? "Intermodal Freight Terminal" : "Transport Hub"),
          lng: n.coordinates[0],
          lat: n.coordinates[1],
          elevation: isIntermodal ? baseElevation * 1.4 : baseElevation,
          nodeType: n.nodeType ?? "junction",
          isIntermodal,
        };
      });
    }

    // Fallback: derive pillars at air corridor endpoints
    const airportCoords = new Map<string, [number, number]>();
    for (const arc of flightArcs) {
      airportCoords.set(`${arc.source[0].toFixed(3)},${arc.source[1].toFixed(3)}`, arc.source);
      airportCoords.set(`${arc.target[0].toFixed(3)},${arc.target[1].toFixed(3)}`, arc.target);
    }

    const derived: HubPillarData[] = [];
    let idx = 0;
    airportCoords.forEach(([lng, lat]) => {
      derived.push({
        id: `derived-hub-${idx++}`,
        name: "Terminal Hub",
        lng,
        lat,
        elevation: 8000,
        nodeType: "airport",
      });
    });

    return derived;
  }, [nodes, segments, flightArcs, enableHubPillars]);

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

        currentTimeRef.current = (currentTimeRef.current + deltaSec * speedMultiplier) % loopDuration;

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
