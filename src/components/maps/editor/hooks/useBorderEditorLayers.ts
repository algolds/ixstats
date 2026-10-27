"use client";

/**
 * Attaches the border editor's sources, layers and interaction handlers to the shared
 * MapLibre instance and tears them down when border editing deactivates. The world map
 * stays mounted underneath, so a mode switch never reloads it.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Position, Polygon, MultiPolygon, Feature, FeatureCollection } from "geojson";
import type { VertexRef } from "~/lib/maps/border-editor";
import { getVertices, getAllRings } from "~/lib/maps/border-editor";
import type { BorderDragFrame } from "~/lib/maps/border-drag";
import { kmPerDegreeLat, kmPerDegreeLng } from "~/lib/maps/planet";
import {
  EMPTY_FC,
  collection,
  getGeoJSONSource,
  lineFeature,
  midpointFeatures,
  pointFeature,
  upsertGeoJSONLayers,
  type GeoJSONSourceOptions,
  type SourcelessLayer,
} from "../utils/map-helpers";
import { circle, fill, line } from "../utils/editor-layer-specs";
import { createListeners } from "./map-interaction";
import { coalesceToFrame } from "~/lib/frame-coalesce";

/** The vertices' feature id property ("ring:vertex"), the key of their feature-state. */
const VERTEX_ID = "vid";

/** Border-edit sources, their layers (z-order is array order) and any source options. */
const BORDER_SOURCES: Array<
  [sourceId: string, layers: SourcelessLayer[], options?: GeoJSONSourceOptions]
> = [
  [
    "neighbors",
    [
      fill("neighbors-fill", { "fill-color": "#4a5568", "fill-opacity": 0.3 }),
      line("neighbors-line", { "line-color": "#718096", "line-width": 0.5 }),
    ],
  ],
  ["merge-targets", [fill("merge-targets-fill", { "fill-color": "#4299e1", "fill-opacity": 0.3 })]],
  [
    "active-feature",
    [
      fill("active-fill", { "fill-color": "#48bb78", "fill-opacity": 0.25 }),
      line("active-line", { "line-color": "#48bb78", "line-width": 2 }),
    ],
  ],
  [
    "vertices",
    [
      circle("vertices-circles", {
        "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 7, 4],
        "circle-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#f6e05e",
          "#fff",
        ],
        "circle-stroke-color": "#000",
        "circle-stroke-width": 1,
        // The vertex being dragged is drawn by the border-drag source instead
        "circle-opacity": ["case", ["boolean", ["feature-state", "dragging"], false], 0, 1],
        "circle-stroke-opacity": ["case", ["boolean", ["feature-state", "dragging"], false], 0, 1],
      }),
    ],
    // Selection and drag are feature-state on this id, so neither resends the vertices
    { promoteId: VERTEX_ID },
  ],
  [
    "midpoints",
    [
      circle("midpoints-circles", {
        "circle-radius": 3,
        "circle-color": "#a0aec0",
        "circle-stroke-color": "#000",
        "circle-stroke-width": 0.5,
        "circle-opacity": 0.6,
      }),
    ],
  ],
  [
    "border-drag",
    [
      line(
        "border-drag-edges",
        { "line-color": "#f6e05e", "line-width": 2 },
        {
          filter: ["==", "$type", "LineString"],
        }
      ),
      circle(
        "border-drag-vertex",
        {
          "circle-radius": 7,
          "circle-color": "#f6e05e",
          "circle-stroke-color": "#000",
          "circle-stroke-width": 1,
        },
        ["==", "$type", "Point"]
      ),
    ],
  ],
  [
    "split-line",
    [
      line("split-line-layer", {
        "line-color": "#f56565",
        "line-width": 2,
        "line-dasharray": [4, 2],
      }),
      circle(
        "split-points",
        {
          "circle-radius": 5,
          "circle-color": "#f56565",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
        ["==", "$type", "Point"]
      ),
    ],
  ],
  [
    "trace-start",
    [
      circle("trace-start-circle", {
        "circle-radius": 7,
        "circle-color": "#3b82f6",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.5,
      }),
    ],
  ],
  [
    "brush-cursor",
    [
      line("brush-cursor-layer", {
        "line-color": "#a855f7",
        "line-width": 1.5,
        "line-dasharray": [2, 2],
      }),
      fill("brush-cursor-fill", { "fill-color": "#a855f7", "fill-opacity": 0.1 }),
    ],
  ],
];

const vertexId = ({ ringIndex, vertexIndex }: Pick<VertexRef, "ringIndex" | "vertexIndex">) =>
  `${ringIndex}:${vertexIndex}`;

/** Sets or clears a vertex's `selected` / `dragging` feature-state (no-op once the source is gone). */
function markVertex(
  map: MapLibreMap,
  vertex: Pick<VertexRef, "ringIndex" | "vertexIndex">,
  key: "selected" | "dragging",
  on: boolean
) {
  if (!map.getSource("vertices")) return;
  const target = { source: "vertices", id: vertexId(vertex) };
  if (on) map.setFeatureState(target, { [key]: true });
  else map.removeFeatureState(target, key);
}

const featureOf = (geometry: Polygon | MultiPolygon): Feature => ({
  type: "Feature",
  geometry,
  properties: {},
});

/** What the border-drag source shows: the dragged vertex and the edges around it. */
const dragFeatures = ({ vertex, edges }: BorderDragFrame) =>
  collection([pointFeature(vertex), ...edges.map((edge) => lineFeature(edge))]);

function getCircleCoords(center: [number, number], radiusKm: number): number[][] {
  const steps = 64;
  const kmLng = kmPerDegreeLng(center[1]);
  const kmLat = kmPerDegreeLat();
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / steps;
    return [
      center[0] + (radiusKm * Math.cos(angle)) / kmLng,
      center[1] + (radiusKm * Math.sin(angle)) / kmLat,
    ];
  });
}

interface UseBorderEditorLayersProps {
  map: MapLibreMap | null;
  isActive: boolean;
  geometry: Polygon | MultiPolygon | null;
  /** The neighbouring features' outlines as the editor holds them, by feature id. */
  neighborGeometries?: Record<string, Polygon | MultiPolygon>;
  mode: string;
  splitLine: Position[];
  mergeTargets: string[];
  selectedVertex: VertexRef | null;
  onMapClick: (lng: number, lat: number) => void;
  /** Moves the dragged vertex to the pointer; returns what to draw (editor state is not touched). */
  onVertexDrag: (ref: VertexRef, pointer: Position) => BorderDragFrame | null;
  /** Ends the drag; true when the vertex moved and the editor state was updated. */
  onDragEnd?: () => boolean;
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
  };

  const safeSetData = useCallback(
    (sourceId: string, data: FeatureCollection) => getGeoJSONSource(map, sourceId)?.setData(data),
    [map]
  );

  /** The vertex whose own circle is hidden while the border-drag overlay stands in for it. */
  const draggedVertex = useRef<VertexRef | null>(null);
  /** Takes the drag overlay down (a no-op when none is up). */
  const clearDragOverlay = useCallback(() => {
    const shown = draggedVertex.current;
    if (!map || !shown) return;
    draggedVertex.current = null;
    safeSetData("border-drag", EMPTY_FC);
    markVertex(map, shown, "dragging", false);
  }, [map, safeSetData]);

  // Attach / detach: sources, layers, and event handlers.
  useEffect(() => {
    if (!map || !isActive) return;

    const addSourcesAndLayers = () => {
      if (!map.getSource("neighbors")) {
        for (const [sourceId, layers, options] of BORDER_SOURCES) {
          upsertGeoJSONLayers(map, sourceId, EMPTY_FC, layers, options);
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

    // A vertex drag runs once per frame with the latest pointer; the editor keeps the geometry in a
    // ref and hands back the outline and the tiny overlay to draw, so React does not render
    const vertexDrag = coalesceToFrame((lngLat: [number, number]) => {
      const vertex = draggingVertex.current;
      if (!vertex) return;
      const frame = latest.current.onVertexDrag(vertex, lngLat);
      if (!frame) return;
      if (!draggedVertex.current) {
        draggedVertex.current = vertex;
        markVertex(map, vertex, "dragging", true);
      }
      safeSetData("border-drag", dragFeatures(frame));
      safeSetData("active-feature", collection([featureOf(frame.geometry)]));
    });

    const handleMousemove = (e: MapLayerMouseEvent) => {
      const current = latest.current.mode;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (draggingVertex.current) vertexDrag.schedule(lngLat);

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
      vertexDrag.flush(); // the vertex lands where the pointer stopped
      if (draggingVertex.current) {
        draggingVertex.current = null;
        canvas.style.cursor = "";
        // After a commit the overlay stays until the new outline reaches the vertex source
        if (!latest.current.onDragEnd?.()) clearDragOverlay();
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
      vertexDrag.cancel();
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
      draggedVertex.current = null;
      isBrushing.current = false;
      brushStrokePoints.current = [];
      setReady(false);
    };
  }, [map, isActive, safeSetData, clearDragOverlay]);

  useBorderLayerData({
    ready,
    safeSetData,
    clearDragOverlay,
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
  clearDragOverlay: () => void;
  traceStart: [number, number] | null;
};

/** Keeps the border-edit sources in step with the editor state, once the layers exist. */
function useBorderLayerData({
  ready,
  safeSetData,
  clearDragOverlay,
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
    safeSetData("active-feature", collection(geometry ? [featureOf(geometry)] : []));
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
                [VERTEX_ID]: vertexId(v),
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
    // A dragged vertex now sits in the data: the drag overlay can go
    clearDragOverlay();
  }, [geometry, mode, ready, safeSetData, clearDragOverlay]);

  // The selected vertex is feature-state on its id: choosing one does not resend the vertices
  const selectedRing = selectedVertex?.ringIndex;
  const selectedIndex = selectedVertex?.vertexIndex;
  useEffect(() => {
    if (!map || !ready || selectedRing === undefined || selectedIndex === undefined) return;
    const vertex = { ringIndex: selectedRing, vertexIndex: selectedIndex };
    markVertex(map, vertex, "selected", true);
    return () => markVertex(map, vertex, "selected", false);
  }, [map, ready, selectedRing, selectedIndex]);

  useEffect(() => {
    if (!ready) return;
    safeSetData(
      "neighbors",
      collection(
        Object.entries(neighborGeometries ?? {}).map(([id, shape]) => ({
          ...featureOf(shape),
          properties: { id },
        }))
      )
    );
  }, [neighborGeometries, ready, safeSetData]);

  useEffect(() => {
    if (!ready) return;
    safeSetData(
      "merge-targets",
      collection(
        mergeTargets.flatMap((id) => {
          const shape = neighborGeometries?.[id];
          return shape ? [featureOf(shape)] : [];
        })
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
