"use client";

/**
 * useBorderEditorLayers — attaches the border-editor's sources, layers, and
 * interaction handlers to an EXISTING (shared) MapLibre instance, and tears them
 * down cleanly when border editing deactivates.
 *
 * This replaces the old standalone <BorderEditorMap> component, which owned its
 * own maplibre instance and called map.remove() on every mode switch — forcing a
 * full map reload. The world map now stays mounted underneath the editing layers.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Position, Polygon, MultiPolygon, Feature, FeatureCollection } from "geojson";
import type { VertexRef } from "~/lib/border-editor";
import { getVertices, getAllRings } from "~/lib/border-editor";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

// Border-edit layers/sources, listed so teardown can remove exactly what we added.
const BORDER_LAYER_IDS = [
  "neighbors-fill",
  "neighbors-line",
  "merge-targets-fill",
  "active-fill",
  "active-line",
  "vertices-circles",
  "midpoints-circles",
  "split-line-layer",
  "split-points",
  "trace-start-circle",
  "brush-cursor-layer",
  "brush-cursor-fill",
];
const BORDER_SOURCE_IDS = [
  "neighbors",
  "merge-targets",
  "active-feature",
  "vertices",
  "midpoints",
  "split-line",
  "trace-start",
  "brush-cursor",
];

function getCircleCoords(center: [number, number], radiusKm: number): number[][] {
  const coords: number[][] = [];
  const steps = 64;
  const kmPerDegreeLng = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const kmPerDegreeLat = 110.574;
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    coords.push([center[0] + dx / kmPerDegreeLng, center[1] + dy / kmPerDegreeLat]);
  }
  return coords;
}

export interface UseBorderEditorLayersProps {
  map: MapLibreMap | null;
  isActive: boolean;
  geometry: Polygon | MultiPolygon | null;
  neighborGeometries?: Array<{ featureId: string; geometry: unknown }>;
  mode: string;
  splitLine: Position[];
  mergeTargets: string[];
  selectedVertex: VertexRef | null;
  onMapClick: (lng: number, lat: number) => void;
  onVertexDrag: (ref: VertexRef, to: Position) => void;
  onDragEnd?: () => void;
  brushRadius?: number;
  brushTargetId?: string | null;
  onBrushStroke?: (
    strokePoints: [number, number][],
    radiusKm: number,
    targetFeatureId: string
  ) => boolean;
  traceStart?: [number, number] | null;
  onToggleMergeTarget?: (featureId: string) => void;
}

export function useBorderEditorLayers({
  map,
  isActive,
  geometry,
  neighborGeometries,
  mode,
  splitLine,
  mergeTargets,
  selectedVertex,
  onMapClick,
  onVertexDrag,
  onDragEnd,
  brushRadius = 20,
  brushTargetId = null,
  onBrushStroke,
  traceStart = null,
  onToggleMergeTarget,
}: UseBorderEditorLayersProps) {
  // `ready` is state (not a ref) so the data-sync effects re-run once our sources
  // actually exist on the map — no more on("load") fallback dance.
  const [ready, setReady] = useState(false);

  const draggingVertex = useRef<VertexRef | null>(null);
  const isBrushing = useRef(false);
  const brushStrokePoints = useRef<[number, number][]>([]);

  // Keep current values in refs so the once-attached handlers never go stale.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const brushRadiusRef = useRef(brushRadius);
  brushRadiusRef.current = brushRadius;
  const brushTargetIdRef = useRef(brushTargetId);
  brushTargetIdRef.current = brushTargetId;
  const onBrushStrokeRef = useRef(onBrushStroke);
  onBrushStrokeRef.current = onBrushStroke;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const onToggleMergeTargetRef = useRef(onToggleMergeTarget);
  onToggleMergeTargetRef.current = onToggleMergeTarget;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onVertexDragRef = useRef(onVertexDrag);
  onVertexDragRef.current = onVertexDrag;
  const neighborGeometriesRef = useRef(neighborGeometries);
  neighborGeometriesRef.current = neighborGeometries;

  const safeSetData = useCallback(
    (sourceId: string, data: FeatureCollection) => {
      if (!map) return false;
      const source = map.getSource(sourceId) as { setData?: (d: FeatureCollection) => void } | undefined;
      if (!source?.setData) return false;
      source.setData(data);
      return true;
    },
    [map]
  );

  // ── Attach / detach: sources, layers, and event handlers ──
  useEffect(() => {
    if (!map || !isActive) return;

    const addSourcesAndLayers = () => {
      if (map.getSource("neighbors")) {
        setReady(true);
        return; // already attached (idempotent)
      }

      map.addSource("neighbors", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "neighbors-fill",
        type: "fill",
        source: "neighbors",
        paint: { "fill-color": "#4a5568", "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: "neighbors-line",
        type: "line",
        source: "neighbors",
        paint: { "line-color": "#718096", "line-width": 0.5 },
      });

      map.addSource("merge-targets", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "merge-targets-fill",
        type: "fill",
        source: "merge-targets",
        paint: { "fill-color": "#4299e1", "fill-opacity": 0.3 },
      });

      map.addSource("active-feature", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "active-fill",
        type: "fill",
        source: "active-feature",
        paint: { "fill-color": "#48bb78", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "active-line",
        type: "line",
        source: "active-feature",
        paint: { "line-color": "#48bb78", "line-width": 2 },
      });

      map.addSource("vertices", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "vertices-circles",
        type: "circle",
        source: "vertices",
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], true], 7, 4],
          "circle-color": ["case", ["==", ["get", "selected"], true], "#f6e05e", "#fff"],
          "circle-stroke-color": "#000",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("midpoints", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "midpoints-circles",
        type: "circle",
        source: "midpoints",
        paint: {
          "circle-radius": 3,
          "circle-color": "#a0aec0",
          "circle-stroke-color": "#000",
          "circle-stroke-width": 0.5,
          "circle-opacity": 0.6,
        },
      });

      map.addSource("split-line", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "split-line-layer",
        type: "line",
        source: "split-line",
        paint: { "line-color": "#f56565", "line-width": 2, "line-dasharray": [4, 2] },
      });
      map.addLayer({
        id: "split-points",
        type: "circle",
        source: "split-line",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#f56565",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("trace-start", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "trace-start-circle",
        type: "circle",
        source: "trace-start",
        paint: {
          "circle-radius": 7,
          "circle-color": "#3b82f6",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });

      map.addSource("brush-cursor", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "brush-cursor-layer",
        type: "line",
        source: "brush-cursor",
        paint: { "line-color": "#a855f7", "line-width": 1.5, "line-dasharray": [2, 2] },
      });
      map.addLayer({
        id: "brush-cursor-fill",
        type: "fill",
        source: "brush-cursor",
        paint: { "fill-color": "#a855f7", "fill-opacity": 0.1 },
      });

      setReady(true);
    };

    // The shared map is usually already loaded; if not, wait for the next styledata.
    const onStyle = () => addSourcesAndLayers();
    if (map.isStyleLoaded()) addSourcesAndLayers();
    else map.once("styledata", onStyle);

    // ── Interaction handlers (named, so detach can map.off them) ──
    const handleClick = (e: any) => {
      if (modeRef.current === "brush") return;
      if (modeRef.current === "merge") {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["neighbors-fill"] });
        if (hits.length > 0) {
          const hitId = hits[0]?.properties?.id as string | undefined;
          if (hitId && onToggleMergeTargetRef.current) {
            onToggleMergeTargetRef.current(hitId);
            return;
          }
        }
      }
      onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
    };

    const handleVertexMousedown = (e: any) => {
      if (modeRef.current !== "vertex_edit") return;
      e.preventDefault();
      const feat = e.features?.[0];
      if (!feat?.properties) return;
      draggingVertex.current = {
        ringIndex: feat.properties.ringIndex as number,
        vertexIndex: feat.properties.vertexIndex as number,
        coord: [e.lngLat.lng, e.lngLat.lat],
      };
      map.getCanvas().style.cursor = "grabbing";
    };

    const handleBrushMousedown = (e: any) => {
      if (modeRef.current === "brush" && brushTargetIdRef.current) {
        isBrushing.current = true;
        brushStrokePoints.current = [[e.lngLat.lng, e.lngLat.lat]];
        map.dragPan.disable();
      }
    };

    const handleMousemove = (e: any) => {
      if (draggingVertex.current) {
        let to: Position = [e.lngLat.lng, e.lngLat.lat];
        const neighbors = neighborGeometriesRef.current;
        if (neighbors && neighbors.length > 0) {
          const snapTolerance = 0.05;
          let bestSnapDist = Infinity;
          let bestSnapPos: Position | null = null;
          for (const neighbor of neighbors) {
            const geom = neighbor.geometry as Polygon | MultiPolygon;
            if (!geom) continue;
            const rings = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
            for (const ring of rings) {
              for (const coord of ring) {
                const dx = coord[0] - to[0];
                const dy = coord[1] - to[1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < snapTolerance && dist < bestSnapDist) {
                  bestSnapDist = dist;
                  bestSnapPos = [...coord];
                }
              }
            }
          }
          if (bestSnapPos) to = bestSnapPos;
        }
        onVertexDragRef.current(draggingVertex.current, to);
      }

      if (modeRef.current === "brush") {
        map.getCanvas().style.cursor = "crosshair";
        const center: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const circleFC: FeatureCollection = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [getCircleCoords(center, brushRadiusRef.current)] },
              properties: {},
            },
          ],
        };
        safeSetData("brush-cursor", circleFC);
        if (isBrushing.current && brushTargetIdRef.current) {
          brushStrokePoints.current.push(center);
        }
      } else if (!draggingVertex.current) {
        map.getCanvas().style.cursor = "";
      }
    };

    const finishBrushing = () => {
      if (isBrushing.current) {
        isBrushing.current = false;
        map.dragPan.enable();
        if (
          brushStrokePoints.current.length > 0 &&
          onBrushStrokeRef.current &&
          brushTargetIdRef.current
        ) {
          onBrushStrokeRef.current(
            brushStrokePoints.current,
            brushRadiusRef.current,
            brushTargetIdRef.current
          );
        }
        brushStrokePoints.current = [];
      }
    };

    const handleMouseup = () => {
      if (draggingVertex.current) {
        draggingVertex.current = null;
        map.getCanvas().style.cursor = "";
        onDragEndRef.current?.();
      }
      finishBrushing();
    };
    const handleMouseleave = () => finishBrushing();
    const handleVertexEnter = () => {
      if (modeRef.current === "vertex_edit") map.getCanvas().style.cursor = "grab";
    };
    const handleVertexLeave = () => {
      if (!draggingVertex.current) map.getCanvas().style.cursor = "";
    };

    map.on("click", handleClick);
    map.on("mousedown", "vertices-circles", handleVertexMousedown);
    map.on("mousedown", handleBrushMousedown);
    map.on("mousemove", handleMousemove);
    map.on("mouseup", handleMouseup);
    map.on("mouseleave", handleMouseleave);
    map.on("mouseenter", "vertices-circles", handleVertexEnter);
    map.on("mouseleave", "vertices-circles", handleVertexLeave);

    return () => {
      map.off("styledata", onStyle);
      map.off("click", handleClick);
      map.off("mousedown", "vertices-circles", handleVertexMousedown);
      map.off("mousedown", handleBrushMousedown);
      map.off("mousemove", handleMousemove);
      map.off("mouseup", handleMouseup);
      map.off("mouseleave", handleMouseleave);
      map.off("mouseenter", "vertices-circles", handleVertexEnter);
      map.off("mouseleave", "vertices-circles", handleVertexLeave);

      // Remove layers before their sources.
      for (const id of BORDER_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of BORDER_SOURCE_IDS) {
        if (map.getSource(id)) map.removeSource(id);
      }

      try {
        map.dragPan.enable();
      } catch {
        /* map may be gone */
      }
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = "";
      draggingVertex.current = null;
      isBrushing.current = false;
      brushStrokePoints.current = [];
      setReady(false);
    };
  }, [map, isActive, safeSetData]);

  // ── Data-sync effects (gated on `ready`) ──

  // Clear brush cursor when leaving brush mode
  useEffect(() => {
    if (ready && mode !== "brush") safeSetData("brush-cursor", EMPTY_FC);
  }, [mode, ready, safeSetData]);

  // Active feature geometry
  useEffect(() => {
    if (!ready) return;
    const fc = geometry
      ? {
          type: "FeatureCollection" as const,
          features: [{ type: "Feature" as const, geometry, properties: {} }],
        }
      : EMPTY_FC;
    safeSetData("active-feature", fc);
  }, [geometry, ready, safeSetData]);

  // Vertices + midpoints
  useEffect(() => {
    if (!ready) return;
    let vFC: FeatureCollection = EMPTY_FC;
    let mFC: FeatureCollection = EMPTY_FC;

    if (geometry && mode === "vertex_edit") {
      const vertices = getVertices(geometry);
      const vFeatures: Feature[] = vertices.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: v.coord },
        properties: {
          ringIndex: v.ringIndex,
          vertexIndex: v.vertexIndex,
          selected:
            selectedVertex?.ringIndex === v.ringIndex &&
            selectedVertex?.vertexIndex === v.vertexIndex,
        },
      }));
      vFC = { type: "FeatureCollection", features: vFeatures };

      const rings = getAllRings(geometry);
      const mFeatures: Feature[] = [];
      for (let rIdx = 0; rIdx < rings.length; rIdx++) {
        const ring = rings[rIdx]!;
        for (let vIdx = 0; vIdx < ring.length - 1; vIdx++) {
          const p1 = ring[vIdx]!;
          const p2 = ring[vIdx + 1]!;
          const mid: Position = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
          mFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: mid },
            properties: { ringIndex: rIdx, edgeIndex: vIdx },
          });
        }
      }
      mFC = { type: "FeatureCollection", features: mFeatures };
    }

    safeSetData("vertices", vFC);
    safeSetData("midpoints", mFC);
  }, [geometry, mode, selectedVertex, ready, safeSetData]);

  // Neighbor geometries
  useEffect(() => {
    if (!ready) return;
    const features: Feature[] = [];
    if (neighborGeometries) {
      for (const geom of neighborGeometries) {
        if (geom.geometry) {
          features.push({
            type: "Feature",
            geometry: geom.geometry as Polygon | MultiPolygon,
            properties: { id: geom.featureId },
          });
        }
      }
    }
    safeSetData("neighbors", { type: "FeatureCollection", features });
  }, [neighborGeometries, ready, safeSetData]);

  // Merge targets
  useEffect(() => {
    if (!ready) return;
    const features: Feature[] = [];
    if (neighborGeometries && mergeTargets.length > 0) {
      for (const geom of neighborGeometries) {
        if (geom.geometry && mergeTargets.includes(geom.featureId)) {
          features.push({
            type: "Feature",
            geometry: geom.geometry as Polygon | MultiPolygon,
            properties: {},
          });
        }
      }
    }
    safeSetData("merge-targets", { type: "FeatureCollection", features });
  }, [neighborGeometries, mergeTargets, ready, safeSetData]);

  // Split line
  useEffect(() => {
    if (!ready) return;
    let fc = EMPTY_FC;
    if (mode === "split" && splitLine.length > 0) {
      const features: Feature[] = [];
      if (splitLine.length >= 2) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: splitLine },
          properties: {},
        });
      }
      for (const pt of splitLine) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: pt },
          properties: {},
        });
      }
      fc = { type: "FeatureCollection", features };
    }
    safeSetData("split-line", fc);
  }, [splitLine, mode, ready, safeSetData]);

  // Trace start point
  useEffect(() => {
    if (!ready) return;
    const fc = traceStart
      ? {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: traceStart },
              properties: {},
            },
          ],
        }
      : EMPTY_FC;
    safeSetData("trace-start", fc);
  }, [traceStart, ready, safeSetData]);

  // Fit the map to the loaded feature when editing begins
  const hasGeometry = !!geometry;
  useEffect(() => {
    if (!map || !ready || !geometry) return;
    const rings = getAllRings(geometry);
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const ring of rings) {
      for (const coord of ring) {
        if (coord[0]! < minLng) minLng = coord[0]!;
        if (coord[0]! > maxLng) maxLng = coord[0]!;
        if (coord[1]! < minLat) minLat = coord[1]!;
        if (coord[1]! > maxLat) maxLat = coord[1]!;
      }
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, duration: 1000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGeometry, ready]);
}
