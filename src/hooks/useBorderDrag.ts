"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Polygon, MultiPolygon, Position } from "geojson";
import {
  calculateArea,
  pushUndo,
  type NeighborChanges,
  type VertexRef,
} from "~/lib/maps/border-editor";
import {
  dragBorderVertex,
  startBorderDrag,
  type BorderDragFrame,
  type BorderDragStart,
} from "~/lib/maps/border-drag";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import type { BorderEditorState } from "./useBorderEditor";

type Shape = Polygon | MultiPolygon;

/** The drag in progress: where it started from and where the pointer has taken it. */
interface ActiveDrag {
  start: BorderDragStart;
  to: Position;
  geometry: Shape;
  moved: Record<string, Shape>;
}

/** The editor state with a finished drag applied as one undo step. */
function withDrag(s: BorderEditorState, drag: ActiveDrag): BorderEditorState {
  const { start } = drag;
  // The neighbours the drag carried along, so undo/redo move them too
  const neighbors: NeighborChanges = Object.fromEntries(
    start.partners.map(({ featureId }) => [
      featureId,
      { before: start.neighborGeometries[featureId]!, after: drag.moved[featureId]! },
    ])
  );
  return {
    ...s,
    geometry: drag.geometry,
    neighborGeometries: { ...s.neighborGeometries, ...drag.moved },
    dirtyNeighbors: { ...s.dirtyNeighbors, ...drag.moved },
    undoStackState: pushUndo(
      s.undoStackState,
      "move_vertex",
      start.geometry,
      drag.geometry,
      neighbors
    ),
    isDirty: true,
    areaKm2: calculateArea(drag.geometry),
    selectedVertex: { ringIndex: start.ringIndex, vertexIndex: start.vertexIndex, coord: drag.to },
  };
}

/**
 * Vertex dragging for the border editor. The shapes live in a ref while the pointer moves, so a
 * frame costs a ring copy and a tiny overlay, and React does not render at all; the live area goes
 * through the transient store. `commitDrag` sets state once, as a single undo entry.
 */
export function useBorderDrag(
  stateRef: RefObject<BorderEditorState>,
  setState: Dispatch<SetStateAction<BorderEditorState>>
) {
  const dragRef = useRef<ActiveDrag | null>(null);

  useEffect(
    () => () => {
      dragRef.current = null;
      transientMapStore.setBorderAreaKm2(null);
    },
    []
  );

  /** Moves the vertex to the pointer and returns what to draw, without touching React state. */
  const handleVertexDrag = useCallback(
    (ref: VertexRef, pointer: Position): BorderDragFrame | null => {
      const { featureId, geometry, neighborGeometries } = stateRef.current;
      if (!geometry || !featureId) return null;
      // The first frame captures the pre-drag shapes and the neighbour vertices on the dragged one,
      // matched on the vertex itself (not the pointer) and kept for the whole drag
      const start =
        dragRef.current?.start ?? startBorderDrag(featureId, geometry, neighborGeometries, ref);
      const step = dragBorderVertex(start, pointer);
      dragRef.current = { start, to: step.to, geometry: step.geometry, moved: step.moved };
      transientMapStore.setBorderAreaKm2(calculateArea(step.geometry));
      return step.frame;
    },
    [stateRef]
  );

  /** Ends the drag (on mouseup). True when the vertex ended somewhere new and state was updated. */
  const commitDrag = useCallback((): boolean => {
    const drag = dragRef.current;
    dragRef.current = null;
    transientMapStore.setBorderAreaKm2(null);
    if (!drag || (drag.to[0] === drag.start.at[0] && drag.to[1] === drag.start.at[1])) return false;
    setState((s) => (s.geometry && s.featureId === drag.start.featureId ? withDrag(s, drag) : s));
    return true;
  }, [setState]);

  return { handleVertexDrag, commitDrag };
}
