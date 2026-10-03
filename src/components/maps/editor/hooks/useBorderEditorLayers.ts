"use client";

/**
 * Attaches the border editor's sources, layers and interaction handlers to the shared
 * MapLibre instance and tears them down when border editing deactivates. The world map
 * stays mounted underneath, so a mode switch never reloads it.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Position, Polygon, MultiPolygon, FeatureCollection } from "geojson";
import type { VertexRef } from "~/lib/maps/border-editor";
import { getVertices, getAllRings } from "~/lib/maps/border-editor";
import {
  EMPTY_FC,
  collection,
  getGeoJSONSource,
  lineFeature,
  midpointFeatures,
  pointFeature,
  upsertGeoJSONLayers,
  type SourcelessLayer,
} from "../utils/map-helpers";
import { createListeners } from "./map-interaction";

/** Border-edit sources and their layers (z-order is array order). */
const BORDER_SOURCES: Array<[sourceId: string, layers: SourcelessLayer[]]> = [
  [
    "neighbors",
    [
      {
        id: "neighbors-fill",
        type: "fill",
        paint: { "fill-color": "#4a5568", "fill-opacity": 0.3 },
      },
      { id: "neighbors-line", type: "line", paint: { "line-color": "#718096", "line-width": 0.5 } },
    ],
  ],
  [
    "merge-targets",
    [
      {
        id: "merge-targets-fill",
        type: "fill",
        paint: { "fill-color": "#4299e1", "fill-opacity": 0.3 },
      },
    ],
  ],
  [
    "active-feature",
    [
      { id: "active-fill", type: "fill", paint: { "fill-color": "#48bb78", "fill-opacity": 0.25 } },
      { id: "active-line", type: "line", paint: { "line-color": "#48bb78", "line-width": 2 } },
    ],
  ],
  [
    "vertices",
    [
      {
        id: "vertices-circles",
        type: "circle",
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], true], 7, 4],
          "circle-color": ["case", ["==", ["get", "selected"], true], "#f6e05e", "#fff"],
          "circle-stroke-color": "#000",
          "circle-stroke-width": 1,
        },
      },
    ],
  ],
  [
    "midpoints",
    [
      {
        id: "midpoints-circles",
        type: "circle",
        paint: {
          "circle-radius": 3,
          "circle-color": "#a0aec0",
          "circle-stroke-color": "#000",
          "circle-stroke-width": 0.5,
          "circle-opacity": 0.6,
        },
      },
    ],
  ],
  [
    "split-line",
    [
      {
        id: "split-line-layer",
        type: "line",
        paint: { "line-color": "#f56565", "line-width": 2, "line-dasharray": [4, 2] },
      },
      {
        id: "split-points",
        type: "circle",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#f56565",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      },
    ],
  ],
  [
    "trace-start",
    [
      {
        id: "trace-start-circle",
        type: "circle",
        paint: {
          "circle-radius": 7,
          "circle-color": "#3b82f6",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      },
    ],
  ],
  [
    "brush-cursor",
    [
      {
        id: "brush-cursor-layer",
        type: "line",
        paint: { "line-color": "#a855f7", "line-width": 1.5, "line-dasharray": [2, 2] },
      },
      {
        id: "brush-cursor-fill",
        type: "fill",
        paint: { "fill-color": "#a855f7", "fill-opacity": 0.1 },
      },
    ],
  ],
];

const SNAP_TO_NEIGHBOR_DEGREES = 0.05;

function getCircleCoords(center: [number, number], radiusKm: number): number[][] {
  const steps = 64;
  const kmPerDegreeLng = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const kmPerDegreeLat = 110.574;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / steps;
    return [
      center[0] + (radiusKm * Math.cos(angle)) / kmPerDegreeLng,
      center[1] + (radiusKm * Math.sin(angle)) / kmPerDegreeLat,
    ];
  });
}

/** The nearest neighbour-border vertex within snapping range, or the point itself. */
function snapToNeighborVertex(
  point: Position,
  neighbors: Array<{ geometry: Polygon | MultiPolygon | null | undefined }>
): Position {
  let best: Position = point;
  let bestDist = Infinity;
  for (const { geometry } of neighbors) {
    if (!geometry) continue;
    for (const coord of getAllRings(geometry).flat()) {
      const dx = coord[0]! - point[0]!;
      const dy = coord[1]! - point[1]!;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SNAP_TO_NEIGHBOR_DEGREES && dist < bestDist) {
        bestDist = dist;
        best = [...coord];
      }
    }
  }
  return best;
}

interface UseBorderEditorLayersProps {
  map: MapLibreMap | null;
  isActive: boolean;
  geometry: Polygon | MultiPolygon | null;
  neighborGeometries?: Array<{
    featureId: string;
    geometry: Polygon | MultiPolygon | null | undefined;
  }>;
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
  // State (not a ref) so the data-sync effects re-run once our sources exist on the map.
  const [ready, setReady] = useState(false);

  const draggingVertex = useRef<VertexRef | null>(null);
  const isBrushing = useRef(false);
  const brushStrokePoints = useRef<[number, number][]>([]);

  // Latest props so the once-attached handlers never go stale.
  const latest = useRef({
    mode,
    brushRadius,
    brushTargetId,
    onBrushStroke,
    onDragEnd,
    onToggleMergeTarget,
    onMapClick,
    onVertexDrag,
    neighborGeometries,
  });
  // oxlint-disable-next-line -- latest-value ref read by the once-attached handlers
  latest.current = {
    mode,
    brushRadius,
    brushTargetId,
    onBrushStroke,
    onDragEnd,
    onToggleMergeTarget,
    onMapClick,
    onVertexDrag,
    neighborGeometries,
  };

  const safeSetData = useCallback(
    (sourceId: string, data: FeatureCollection) => getGeoJSONSource(map, sourceId)?.setData(data),
    [map]
  );

  // Attach / detach: sources, layers, and event handlers.
  useEffect(() => {
    if (!map || !isActive) return;

    const addSourcesAndLayers = () => {
      if (!map.getSource("neighbors")) {
        for (const [sourceId, layers] of BORDER_SOURCES) {
          upsertGeoJSONLayers(map, sourceId, EMPTY_FC, layers);
        }
      }
      setReady(true);
    };

    // The shared map is usually already loaded; if not, wait for the next styledata.
    if (map.isStyleLoaded()) addSourcesAndLayers();
    else map.once("styledata", addSourcesAndLayers);

    const canvas = map.getCanvas();
    const listeners = createListeners(map);

    const handleClick = (e: MapLayerMouseEvent) => {
      const { mode: current, onToggleMergeTarget: toggleMergeTarget } = latest.current;
      if (current === "brush") return;
      if (current === "merge") {
        const hitId = map.queryRenderedFeatures(e.point, { layers: ["neighbors-fill"] })[0]
          ?.properties?.id as string | undefined;
        if (hitId && toggleMergeTarget) {
          toggleMergeTarget(hitId);
          return;
        }
      }
      latest.current.onMapClick(e.lngLat.lng, e.lngLat.lat);
    };

    const handleVertexMousedown = (e: MapLayerMouseEvent) => {
      if (latest.current.mode !== "vertex_edit") return;
      e.preventDefault();
      const props = e.features?.[0]?.properties;
      if (!props) return;
      draggingVertex.current = {
        ringIndex: props.ringIndex as number,
        vertexIndex: props.vertexIndex as number,
        coord: [e.lngLat.lng, e.lngLat.lat],
      };
      canvas.style.cursor = "grabbing";
    };

    const handleBrushMousedown = (e: MapLayerMouseEvent) => {
      if (latest.current.mode === "brush" && latest.current.brushTargetId) {
        isBrushing.current = true;
        brushStrokePoints.current = [[e.lngLat.lng, e.lngLat.lat]];
        map.dragPan.disable();
      }
    };

    const handleMousemove = (e: MapLayerMouseEvent) => {
      const { mode: current, neighborGeometries: neighbors } = latest.current;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (draggingVertex.current) {
        const to = neighbors?.length ? snapToNeighborVertex(lngLat, neighbors) : lngLat;
        latest.current.onVertexDrag(draggingVertex.current, to);
      }

      if (current === "brush") {
        canvas.style.cursor = "crosshair";
        safeSetData(
          "brush-cursor",
          collection([
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [getCircleCoords(lngLat, latest.current.brushRadius)],
              },
              properties: {},
            },
          ])
        );
        if (isBrushing.current && latest.current.brushTargetId) {
          brushStrokePoints.current.push(lngLat);
        }
      } else if (!draggingVertex.current) {
        canvas.style.cursor = "";
      }
    };

    const finishBrushing = () => {
      if (!isBrushing.current) return;
      isBrushing.current = false;
      map.dragPan.enable();
      const {
        onBrushStroke: onStroke,
        brushRadius: radius,
        brushTargetId: targetId,
      } = latest.current;
      if (brushStrokePoints.current.length > 0 && onStroke && targetId) {
        onStroke(brushStrokePoints.current, radius, targetId);
      }
      brushStrokePoints.current = [];
    };

    const handleMouseup = () => {
      if (draggingVertex.current) {
        draggingVertex.current = null;
        canvas.style.cursor = "";
        latest.current.onDragEnd?.();
      }
      finishBrushing();
    };

    listeners.onMap("click", handleClick);
    listeners.onLayer("mousedown", "vertices-circles", handleVertexMousedown);
    listeners.onMap("mousedown", handleBrushMousedown);
    listeners.onMap("mousemove", handleMousemove);
    listeners.onMap("mouseup", handleMouseup);
    // MapLibre 6 only fires mouseenter/mouseleave per layer, so the cursor leaving the whole
    // canvas is the container's native DOM event.
    listeners.onDom(map.getContainer(), "mouseleave", finishBrushing);
    listeners.onLayer("mouseenter", "vertices-circles", () => {
      if (latest.current.mode === "vertex_edit") canvas.style.cursor = "grab";
    });
    listeners.onLayer("mouseleave", "vertices-circles", () => {
      if (!draggingVertex.current) canvas.style.cursor = "";
    });

    return () => {
      map.off("styledata", addSourcesAndLayers);
      listeners.dispose();

      // Remove layers before their sources.
      for (const [, layers] of BORDER_SOURCES) {
        for (const { id } of layers) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
      }
      for (const [sourceId] of BORDER_SOURCES) {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }

      try {
        map.dragPan.enable();
      } catch {
        /* map may be gone */
      }
      if (canvas) canvas.style.cursor = "";
      draggingVertex.current = null;
      isBrushing.current = false;
      brushStrokePoints.current = [];
      setReady(false);
    };
  }, [map, isActive, safeSetData]);

  useBorderLayerData({
    ready,
    safeSetData,
    map,
    geometry,
    neighborGeometries,
    mode,
    splitLine,
    mergeTargets,
    selectedVertex,
    traceStart,
  });
}

type BorderLayerDataProps = Pick<
  UseBorderEditorLayersProps,
  | "map"
  | "geometry"
  | "neighborGeometries"
  | "mode"
  | "splitLine"
  | "mergeTargets"
  | "selectedVertex"
> & {
  ready: boolean;
  safeSetData: (sourceId: string, data: FeatureCollection) => void;
  traceStart: [number, number] | null;
};

/** Keeps the border-edit sources in step with the editor state, once the layers exist. */
function useBorderLayerData({
  ready,
  safeSetData,
  map,
  geometry,
  neighborGeometries,
  mode,
  splitLine,
  mergeTargets,
  selectedVertex,
  traceStart,
}: BorderLayerDataProps) {
  useEffect(() => {
    if (ready && mode !== "brush") safeSetData("brush-cursor", EMPTY_FC);
  }, [mode, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    safeSetData(
      "active-feature",
      collection(geometry ? [{ type: "Feature", geometry, properties: {} }] : [])
    );
  }, [geometry, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    const editing = geometry && mode === "vertex_edit" ? geometry : null;
    safeSetData(
      "vertices",
      collection(
        editing
          ? getVertices(editing).map((v) =>
              pointFeature(v.coord, {
                ringIndex: v.ringIndex,
                vertexIndex: v.vertexIndex,
                selected:
                  selectedVertex?.ringIndex === v.ringIndex &&
                  selectedVertex?.vertexIndex === v.vertexIndex,
              })
            )
          : []
      )
    );
    safeSetData(
      "midpoints",
      collection(
        editing
          ? getAllRings(editing).flatMap((ring, ringIndex) =>
              midpointFeatures(ring, (edgeIndex) => ({ ringIndex, edgeIndex }))
            )
          : []
      )
    );
  }, [geometry, mode, selectedVertex, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    safeSetData(
      "neighbors",
      collection(
        (neighborGeometries ?? []).flatMap((n) =>
          n.geometry
            ? [{ type: "Feature" as const, geometry: n.geometry, properties: { id: n.featureId } }]
            : []
        )
      )
    );
  }, [neighborGeometries, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    safeSetData(
      "merge-targets",
      collection(
        (neighborGeometries ?? []).flatMap((n) =>
          n.geometry && mergeTargets.includes(n.featureId)
            ? [{ type: "Feature" as const, geometry: n.geometry, properties: {} }]
            : []
        )
      )
    );
  }, [neighborGeometries, mergeTargets, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    const points = mode === "split" ? splitLine : [];
    safeSetData(
      "split-line",
      collection([
        ...(points.length >= 2 ? [lineFeature(points)] : []),
        ...points.map((pt) => pointFeature(pt)),
      ])
    );
  }, [splitLine, mode, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    safeSetData("trace-start", collection(traceStart ? [pointFeature(traceStart)] : []));
  }, [traceStart, ready, safeSetData]);

  // Fit the map to the loaded feature when editing begins
  const hasGeometry = !!geometry;
  useEffect(() => {
    if (!map || !ready || !geometry) return;
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const coord of getAllRings(geometry).flat()) {
      minLng = Math.min(minLng, coord[0]!);
      maxLng = Math.max(maxLng, coord[0]!);
      minLat = Math.min(minLat, coord[1]!);
      maxLat = Math.max(maxLat, coord[1]!);
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
