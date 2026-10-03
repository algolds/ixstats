import { useCallback, useEffect } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, MapLayerMouseEvent } from "maplibre-gl";
import type { Polygon, MultiPolygon, Position } from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { moveVertex, addVertex, removeVertex } from "~/lib/maps/border-editor";
import type { VertexRef } from "~/lib/maps/border-editor";
import { cascadeMoveVertex, vkey, type TopologyIndex } from "~/lib/maps/topology-engine";
import { getSnapEnabled, getSnapTolerance } from "~/lib/maps/editor-prefs";
import { getFeatureCoords, updateSnapGuide } from "../utils/map-helpers";
import {
  exceedsHysteresis,
  axisLock,
  nextLockedAxis,
  type DragAxis,
  type ScreenPoint,
} from "./drag-utils";
import { calculateSnapTarget } from "./vertex-edit-geometry";
import { canvasPoint, createListeners, createLongPress, queryNear } from "./map-interaction";

const VERTEX_LAYER = "editor-vedit-vertices-layer";
const MIDPOINT_LAYER = "editor-vedit-midpoints-layer";

interface DragVertexState extends VertexRef {
  originalCoord: Position;
  initialGeometry: Polygon | MultiPolygon;
  startScreenPoint: ScreenPoint;
  committed: boolean;
  lockedAxis: DragAxis | null;
}

/** Mutable state of the active region reshape; lives in a ref so map listeners always see it. */
export interface VertexEditState {
  edit: { featureId: string; currentGeometry: Polygon | MultiPolygon } | null;
  drag: DragVertexState | null;
  hovered: VertexRef | null;
  lastMouse: ScreenPoint | null;
  /** Topology engine: spatial-hash index + neighbour geometry cache for cascade editing. */
  topology: TopologyIndex | null;
  neighbors: Map<string, Polygon | MultiPolygon>;
  /** Neighbours reshaped by the topology cascade during this edit session. */
  changedNeighborIds: Set<string>;
  throttleTimer: ReturnType<typeof setTimeout> | null;
}

export const createVertexEditState = (): VertexEditState => ({
  edit: null,
  drag: null,
  hovered: null,
  lastMouse: null,
  topology: null,
  neighbors: new Map(),
  changedNeighborIds: new Set(),
  throttleTimer: null,
});

/** The latest props the pointer handlers read at event time. */
export interface VertexEditLatest {
  features: EditorFeature[];
  countryGeometry: Polygon | MultiPolygon | null;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
  snapEnabled?: boolean;
  snapTolerance?: number;
  snapPoint?: (coords: [number, number]) => [number, number];
}

interface UseVertexEditPointerProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  st: VertexEditState;
  latest: { readonly current: VertexEditLatest };
  updateVertexEditVis: (fastOnly?: boolean) => void;
  scheduleThrottledUpdate: () => void;
  queueCascadeVisual: (featureId: string, geometry: Polygon | MultiPolygon) => void;
}

const toVertexRef = (f: Pick<MapGeoJSONFeature, "properties" | "geometry">): VertexRef => ({
  ringIndex: f.properties.ringIndex as number,
  vertexIndex: f.properties.vertexIndex as number,
  coord: getFeatureCoords(f.geometry) as Position,
});

const isFormField = (target: EventTarget | null) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes((target as HTMLElement | null)?.tagName ?? "");

const snapDragTarget = (st: VertexEditState, l: VertexEditLatest, coords: [number, number]) =>
  calculateSnapTarget({
    coords,
    snapEnabled: l.snapEnabled ?? getSnapEnabled(),
    snapTolerance: l.snapTolerance ?? getSnapTolerance(),
    worldMapLayers: l.worldMapLayers,
    editorVisibleLayers: l.editorVisibleLayers,
    border: l.countryGeometry,
    features: l.features,
    editingFeatureId: st.edit!.featureId,
    snapPointGuide: l.snapPoint,
  });

/** Moves the neighbours that share the dragged vertex along with it. */
function cascadeNeighbors(
  st: VertexEditState,
  oldCoord: Position,
  target: Position,
  geometry: Polygon | MultiPolygon,
  queueCascadeVisual: UseVertexEditPointerProps["queueCascadeVisual"]
) {
  const featureId = st.edit!.featureId;
  const allGeoms = new Map(st.neighbors);
  allGeoms.set(featureId, geometry);
  const cascaded = cascadeMoveVertex(st.topology!, allGeoms, vkey(oldCoord), target);
  for (const [fid, updatedGeom] of cascaded) {
    if (fid === featureId) continue;
    st.neighbors.set(fid, updatedGeom);
    st.changedNeighborIds.add(fid);
    queueCascadeVisual(fid, updatedGeom);
  }
}

/** Drag, add (midpoint click), remove (right click / long press / Delete) region vertices. */
export function useVertexEditPointer({
  map,
  isLoaded,
  st,
  latest,
  updateVertexEditVis,
  scheduleThrottledUpdate,
  queueCascadeVisual,
}: UseVertexEditPointerProps) {
  const removeVertexAt = useCallback(
    (vertex: VertexRef) => {
      if (!st.edit) return;
      const result = removeVertex(st.edit.currentGeometry, vertex);
      if (!result) return;
      st.edit.currentGeometry = result;
      st.hovered = null;
      updateVertexEditVis();
    },
    [st, updateVertexEditVis]
  );

  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();
    const listeners = createListeners(map);
    const setCursor = (cursor: string) => {
      canvas.style.cursor = cursor;
    };

    const beginDrag = (vertex: VertexRef, startScreenPoint: ScreenPoint, committed: boolean) => {
      st.drag = {
        ...vertex,
        originalCoord: [...vertex.coord],
        initialGeometry: structuredClone(st.edit!.currentGeometry),
        startScreenPoint,
        committed,
        lockedAxis: null,
      };
    };

    const stopDragging = () => {
      map.dragPan.enable();
      setCursor("");
      updateSnapGuide(map, null, null);
    };

    const onVertexMouseDown = (e: MapLayerMouseEvent) => {
      if (!st.edit) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (f) beginDrag(toVertexRef(f), { x: e.point.x, y: e.point.y }, false);
    };

    const onMidpointClick = (e: MapLayerMouseEvent) => {
      if (!st.edit) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;
      const startIndex = f.properties.startIndex as number;
      const midCoord = getFeatureCoords(f.geometry) as Position;
      st.edit.currentGeometry = addVertex(
        st.edit.currentGeometry,
        {
          ringIndex: f.properties.ringIndex as number,
          startIndex,
          endIndex: startIndex + 1,
          midpoint: midCoord,
        },
        midCoord
      );
      updateVertexEditVis();
    };

    const onMouseMove = (e: MapLayerMouseEvent) => {
      const current: ScreenPoint = { x: e.point.x, y: e.point.y };
      st.lastMouse = current;
      const drag = st.drag;
      if (!drag || !st.edit) return;

      // 4px dead zone before a click becomes a drag.
      if (!drag.committed) {
        if (!exceedsHysteresis(drag.startScreenPoint, current)) return;
        drag.committed = true;
        map.dragPan.disable();
        setCursor("grabbing");
      }

      drag.lockedAxis = nextLockedAxis(
        drag.lockedAxis,
        e.originalEvent.shiftKey,
        drag.startScreenPoint,
        current
      );
      const lockedCoords = axisLock(
        drag.originalCoord as [number, number],
        [e.lngLat.lng, e.lngLat.lat],
        drag.lockedAxis
      );
      const { target, didSnap, origTarget } = snapDragTarget(st, latest.current, lockedCoords);
      updateSnapGuide(map, didSnap ? origTarget : null, didSnap ? target : null);

      const newGeo = moveVertex(st.edit.currentGeometry, drag, target);
      st.edit.currentGeometry = newGeo;

      if (st.topology && drag.coord) {
        cascadeNeighbors(st, drag.coord, target, newGeo, queueCascadeVisual);
        st.drag = { ...drag, coord: target };
      }

      updateVertexEditVis(true);
      scheduleThrottledUpdate();
    };

    const flushPendingUpdate = () => {
      if (st.throttleTimer) clearTimeout(st.throttleTimer);
      updateVertexEditVis(false);
    };

    const onMouseUp = () => {
      const drag = st.drag;
      if (!drag) return;
      st.drag = null;
      if (drag.committed) {
        stopDragging();
        flushPendingUpdate();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const drag = st.drag;
      if (e.key !== "Escape" || !drag || !st.edit) return;
      e.preventDefault();
      st.drag = null;
      if (drag.committed) {
        st.edit.currentGeometry = drag.initialGeometry;
        updateVertexEditVis(false);
        stopDragging();
      }
    };

    const onCanvasContextMenu = (ev: MouseEvent) => {
      if (!st.edit) return;
      const hit = queryNear(map, canvasPoint(canvas, ev.clientX, ev.clientY), 12, [
        VERTEX_LAYER,
      ])[0];
      if (!hit) return;
      ev.preventDefault();
      ev.stopPropagation();
      removeVertexAt(toVertexRef(hit));
    };

    // Touch: dragging moves a vertex, a long press removes it.
    const longPress = createLongPress();

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!st.edit || !touch) return;
      const start = canvasPoint(canvas, touch.clientX, touch.clientY);
      longPress.begin(start);
      const hit = queryNear(map, start, 20, [VERTEX_LAYER])[0];
      if (!hit) return;

      const vertex = toVertexRef(hit);
      beginDrag(vertex, start, true);
      map.dragPan.disable();
      longPress.arm(() => {
        if (!st.edit) return;
        st.drag = null;
        map.dragPan.enable();
        removeVertexAt(vertex);
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!st.drag || !st.edit || !touch) return;

      const point = canvasPoint(canvas, touch.clientX, touch.clientY);
      longPress.move(point);

      const lngLat = map.unproject([point.x, point.y]);
      const { target } = snapDragTarget(st, latest.current, [lngLat.lng, lngLat.lat]);
      st.edit.currentGeometry = moveVertex(st.edit.currentGeometry, st.drag, target);
      updateVertexEditVis(true);
      scheduleThrottledUpdate();
      e.preventDefault();
    };

    const onTouchEnd = () => {
      longPress.end();
      if (st.drag) {
        st.drag = null;
        map.dragPan.enable();
        flushPendingUpdate();
      }
    };

    listeners.onLayer("mousedown", VERTEX_LAYER, onVertexMouseDown);
    listeners.onLayer("click", MIDPOINT_LAYER, onMidpointClick);
    listeners.onMap("mousemove", onMouseMove);
    listeners.onDom(canvas, "contextmenu", onCanvasContextMenu);
    listeners.onLayer("mouseenter", VERTEX_LAYER, (e) => {
      if (!st.edit || st.drag) return;
      setCursor("grab");
      const f = e.features?.[0];
      if (f) st.hovered = toVertexRef(f);
    });
    listeners.onLayer("mouseleave", VERTEX_LAYER, () => {
      if (!st.edit || st.drag) return;
      setCursor("");
      st.hovered = null;
    });
    listeners.onLayer("mouseenter", MIDPOINT_LAYER, () => {
      if (st.edit) setCursor("copy");
    });
    listeners.onLayer("mouseleave", MIDPOINT_LAYER, () => {
      if (st.edit && !st.drag) setCursor("");
    });
    // Window-scoped so a release or Escape outside the canvas still ends the drag.
    listeners.onDom(window, "mouseup", onMouseUp);
    listeners.onDom(window, "keydown", onKeyDown);
    listeners.onTouch(canvas, { start: onTouchStart, move: onTouchMove, end: onTouchEnd });

    return () => {
      longPress.cancel();
      listeners.dispose();
    };
  }, [
    map,
    isLoaded,
    st,
    latest,
    updateVertexEditVis,
    scheduleThrottledUpdate,
    queueCascadeVisual,
    removeVertexAt,
  ]);

  useVertexDeleteKey(map, st, removeVertexAt);
}

/** Delete / Backspace removes the hovered vertex (or the one under the last mouse position). */
function useVertexDeleteKey(
  map: MapLibreMap | null,
  st: VertexEditState,
  removeVertexAt: (vertex: VertexRef) => void
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!st.edit || isFormField(e.target)) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      let target = st.hovered;
      if (!target && st.lastMouse && map) {
        const hit = queryNear(map, st.lastMouse, 12, [VERTEX_LAYER])[0];
        if (hit) target = toVertexRef(hit);
      }
      if (target) removeVertexAt(target);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map, st, removeVertexAt]);
}
