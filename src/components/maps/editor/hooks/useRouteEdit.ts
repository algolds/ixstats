import { useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { EditorMode } from "~/hooks/useMapEditor";
import {
  getGeoJSONSource,
  updateSnapGuide,
  getFeatureCoords,
  EMPTY_FC,
  collection,
  lineFeature,
  midpointFeatures,
  pointFeature,
} from "../utils/map-helpers";
import {
  exceedsHysteresis,
  detectAxis,
  axisLock,
  type DragAxis,
  type ScreenPoint,
} from "./drag-utils";
import {
  LONG_PRESS_MOVE_PX,
  LONG_PRESS_MS,
  canvasPoint,
  createListeners,
  queryNear,
} from "./map-interaction";

type Vertex = [number, number];

interface UseRouteEditProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  routeWaypoints?: Vertex[];
  editingRouteVertices?: Vertex[];
  onRouteVerticesUpdate?: (vertices: Vertex[]) => void;
}

interface RouteDrag {
  index: number;
  startPos: ScreenPoint | null;
  startCoords: Vertex | null;
  initialVertices: Vertex[] | null;
  /** Vertices being dragged; drawn straight to the map sources, committed on release. */
  liveVertices: Vertex[] | null;
  exceededHysteresis: boolean;
  axis: DragAxis | null;
}

const VERTEX_LAYER = "editor-route-edit-vertices-layer";
const MIDPOINT_LAYER = "editor-route-edit-midpoints-layer";
const SNAP_LAYERS = ["editor-points-capital", "editor-points-city", "editor-points-poi"];

const replaceAt = (vertices: Vertex[], index: number, vertex: Vertex) =>
  vertices.map((v, i) => (i === index ? vertex : v));

/** The position of a nearby city/POI marker, or `fallback` when none is within reach. */
function snapToNearbyPoint(
  map: MapLibreMap,
  point: { x: number; y: number },
  fallback: Vertex
): Vertex {
  const hit = queryNear(map, point, 15, SNAP_LAYERS)[0];
  const coords = hit && getFeatureCoords(hit.geometry);
  return coords ? [coords[0], coords[1]] : fallback;
}

export function useRouteEdit({
  map,
  isLoaded,
  mode,
  editingRouteVertices,
  onRouteVerticesUpdate,
}: UseRouteEditProps) {
  const dragRef = useRef<RouteDrag | null>(null);

  // Latest props for the stable event callbacks.
  const editingRouteVerticesRef = useRef(editingRouteVertices);
  // oxlint-disable-next-line
  editingRouteVerticesRef.current = editingRouteVertices;
  const onRouteVerticesUpdateRef = useRef(onRouteVerticesUpdate);
  // oxlint-disable-next-line
  onRouteVerticesUpdateRef.current = onRouteVerticesUpdate;

  const updateRouteEditVis = useCallback(
    (overrideVertices?: Vertex[]) => {
      const vertices = overrideVertices ?? editingRouteVerticesRef.current;
      if (!map || !vertices || vertices.length === 0) return;

      getGeoJSONSource(map, "editor-route-edit-line")?.setData(collection([lineFeature(vertices)]));
      getGeoJSONSource(map, "editor-route-edit-vertices")?.setData(
        collection(vertices.map((coord, vertexIndex) => pointFeature(coord, { vertexIndex })))
      );
      getGeoJSONSource(map, "editor-route-edit-midpoints")?.setData(
        collection(midpointFeatures(vertices, (startIndex) => ({ startIndex })))
      );
    },
    [map]
  );

  const clearRouteEditVis = useCallback(() => {
    if (!map) return;
    for (const id of ["line", "vertices", "midpoints"]) {
      getGeoJSONSource(map, `editor-route-edit-${id}`)?.setData(EMPTY_FC);
    }
  }, [map]);

  useEffect(() => {
    updateRouteEditVis();
    // oxlint-disable-next-line
  }, [editingRouteVertices, updateRouteEditVis]);

  useEffect(() => {
    if (mode !== "edit-route") {
      clearRouteEditVis();
    }
  }, [mode, clearRouteEditVis]);

  // Clear snap preview when leaving add-route mode
  useEffect(() => {
    if (mode !== "add-route" && map && isLoaded) {
      getGeoJSONSource(map, "editor-route-snap-preview")?.setData(EMPTY_FC);
      getGeoJSONSource(map, "editor-route-preview-segment")?.setData(EMPTY_FC);
    }
  }, [map, isLoaded, mode]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();
    const listeners = createListeners(map);
    const editing = () => mode === "edit-route";
    const setCursor = (cursor: string) => {
      canvas.style.cursor = cursor;
    };

    /** Removes a vertex (a route keeps at least two). */
    const deleteVertex = (index: number) => {
      const vertices = editingRouteVerticesRef.current;
      if (vertices && vertices.length > 2) {
        onRouteVerticesUpdateRef.current?.(vertices.filter((_, i) => i !== index));
      }
    };

    const endDrag = () => {
      dragRef.current = null;
      map.dragPan.enable();
      setCursor("");
      updateSnapGuide(map, null, null);
    };

    const onVertexMouseDown = (e: MapLayerMouseEvent) => {
      if (!editing()) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const index = f.properties.vertexIndex as number;
      const vertices = editingRouteVerticesRef.current;
      const vertex = vertices?.[index];
      dragRef.current = {
        index,
        startPos: { x: e.point.x, y: e.point.y },
        startCoords: vertex ?? null,
        initialVertices: vertex && vertices ? [...vertices] : null,
        liveVertices: vertex && vertices ? [...vertices] : null,
        exceededHysteresis: false,
        axis: null,
      };
      map.dragPan.disable();
      setCursor("grabbing");
    };

    const onMidpointClick = (e: MapLayerMouseEvent) => {
      if (!editing()) return;
      e.preventDefault();
      const f = e.features?.[0];
      if (!f) return;

      const startIndex = f.properties.startIndex as number;
      const midCoord = getFeatureCoords(f.geometry) as Vertex;
      const vertices = editingRouteVerticesRef.current;
      if (onRouteVerticesUpdateRef.current && vertices) {
        const next = [...vertices];
        next.splice(startIndex + 1, 0, midCoord);
        onRouteVerticesUpdateRef.current(next);
      }
    };

    const onMouseMove = (e: MapLayerMouseEvent) => {
      const drag = dragRef.current;
      if (!editing() || !drag) return;

      // A 4px dead zone prevents accidental single-pixel jitter.
      if (!drag.exceededHysteresis) {
        if (drag.startPos && !exceedsHysteresis(drag.startPos, e.point)) return;
        drag.exceededHysteresis = true;
      }

      let target: Vertex = [e.lngLat.lng, e.lngLat.lat];
      const origTarget = target;

      // Shift locks the drag to horizontal / vertical / 45 degrees.
      if (e.originalEvent?.shiftKey && drag.startCoords && drag.startPos) {
        drag.axis ??= detectAxis(e.point.x - drag.startPos.x, e.point.y - drag.startPos.y);
        target = axisLock(drag.startCoords, target, drag.axis);
      } else {
        drag.axis = null;
      }

      target = snapToNearbyPoint(map, e.point, target);

      const didSnap = target[0] !== origTarget[0] || target[1] !== origTarget[1];
      updateSnapGuide(map, didSnap ? origTarget : null, didSnap ? target : null);

      const baseVertices = drag.liveVertices ?? editingRouteVerticesRef.current;
      if (baseVertices) {
        drag.liveVertices = replaceAt(baseVertices, drag.index, target);
        // Straight to the map sources at 60fps, no React re-render.
        updateRouteEditVis(drag.liveVertices);
      }
    };

    const onMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.liveVertices && drag.exceededHysteresis) {
        onRouteVerticesUpdateRef.current?.(drag.liveVertices);
      }
      endDrag();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const drag = dragRef.current;
      if (e.key !== "Escape" || !drag) return;
      if (drag.initialVertices) {
        updateRouteEditVis(drag.initialVertices);
        onRouteVerticesUpdateRef.current?.(drag.initialVertices);
      }
      endDrag();
    };

    const hitVertexIndex = (point: { x: number; y: number }, radius: number) =>
      queryNear(map, point, radius, [VERTEX_LAYER])[0]?.properties.vertexIndex as
        number | undefined;

    const onContextMenu = (e: MapLayerMouseEvent) => {
      if (!editing()) return;
      const index = hitVertexIndex(e.point, 10);
      if (index === undefined) return;
      e.preventDefault();
      e.originalEvent?.preventDefault();
      deleteVertex(index);
    };

    const onCanvasContextMenu = (ev: MouseEvent) => {
      if (!editing()) return;
      const index = hitVertexIndex(canvasPoint(canvas, ev.clientX, ev.clientY), 12);
      if (index === undefined) return;
      ev.preventDefault();
      ev.stopPropagation();
      deleteVertex(index);
    };

    // Touch: a long press on a vertex deletes it, dragging moves it.
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartPoint: { x: number; y: number } | null = null;
    const cancelLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!editing() || !touch) return;
      touchStartPoint = canvasPoint(canvas, touch.clientX, touch.clientY);

      const index = hitVertexIndex(touchStartPoint, 20);
      if (index === undefined) return;
      dragRef.current = {
        index,
        startPos: null,
        startCoords: null,
        initialVertices: null,
        liveVertices: null,
        exceededHysteresis: false,
        axis: null,
      };
      map.dragPan.disable();

      longPressTimer = setTimeout(() => {
        if (!editing()) return;
        dragRef.current = null;
        map.dragPan.enable();
        deleteVertex(index);
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      const touch = e.touches[0];
      if (!drag || !editing() || !touch) return;

      const point = canvasPoint(canvas, touch.clientX, touch.clientY);
      if (longPressTimer && touchStartPoint) {
        const moved = Math.hypot(point.x - touchStartPoint.x, point.y - touchStartPoint.y);
        if (moved > LONG_PRESS_MOVE_PX) cancelLongPress();
      }

      const lngLat = map.unproject([point.x, point.y]);
      const target = snapToNearbyPoint(map, point, [lngLat.lng, lngLat.lat]);
      const vertices = editingRouteVerticesRef.current;
      if (onRouteVerticesUpdateRef.current && vertices) {
        onRouteVerticesUpdateRef.current(replaceAt(vertices, drag.index, target));
      }
      e.preventDefault();
    };

    const onTouchEnd = () => {
      cancelLongPress();
      touchStartPoint = null;
      if (dragRef.current) {
        dragRef.current = null;
        map.dragPan.enable();
      }
    };

    listeners.onLayer("mousedown", VERTEX_LAYER, onVertexMouseDown);
    listeners.onLayer("click", MIDPOINT_LAYER, onMidpointClick);
    listeners.onMap("mousemove", onMouseMove);
    listeners.onMap("mouseup", onMouseUp);
    listeners.onMap("contextmenu", onContextMenu);
    listeners.onDom(canvas, "contextmenu", onCanvasContextMenu);
    listeners.onLayer("mouseenter", VERTEX_LAYER, () => {
      if (editing() && !dragRef.current) setCursor("grab");
    });
    listeners.onLayer("mouseleave", VERTEX_LAYER, () => {
      if (editing() && !dragRef.current) setCursor("");
    });
    listeners.onLayer("mouseenter", MIDPOINT_LAYER, () => {
      if (editing()) setCursor("copy");
    });
    listeners.onDom(window, "mouseup", onMouseUp);
    listeners.onDom(window, "keydown", onKeyDown);
    listeners.onDom(canvas, "touchstart", onTouchStart, { passive: false });
    listeners.onDom(canvas, "touchmove", onTouchMove, { passive: false });
    listeners.onDom(canvas, "touchend", onTouchEnd);

    return () => {
      cancelLongPress();
      listeners.dispose();
    };
  }, [map, isLoaded, mode, updateRouteEditVis]);
}
