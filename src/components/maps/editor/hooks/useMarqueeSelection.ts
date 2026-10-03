import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon } from "geojson";
import type { EditorMode } from "~/hooks/useMapEditor";
import { collection, getGeoJSONSource } from "../utils/map-helpers";
import { createListeners } from "./map-interaction";
import { useLatest } from "./useLatest";

type SelectionMode = "replace" | "add" | "subtract";

/** Movement (px) below which a marquee press counts as a click. */
const MIN_DRAG_PX = 4;

/** Which marquee a mouse press starts, if any: Shift+drag in view mode, or the lasso tool. */
function marqueeFor(
  mode: EditorMode,
  lassoTool: "freehand" | "rect",
  shift: boolean,
  alt: boolean
) {
  if (mode === "view") {
    return shift ? { isRect: true, selection: (alt ? "subtract" : "add") as SelectionMode } : null;
  }
  if (mode === "lasso-select") {
    const selection: SelectionMode = shift ? "add" : alt ? "subtract" : "replace";
    return { isRect: lassoTool === "rect", selection };
  }
  return null;
}

function rectGeometry(a: [number, number], b: [number, number]): Polygon {
  return {
    type: "Polygon",
    coordinates: [[a, [b[0], a[1]], b, [a[0], b[1]], a]],
  };
}

interface UseMarqueeSelectionProps {
  mapRef: { readonly current: MapLibreMap | null };
  isLoaded: boolean;
  mode: EditorMode;
  lassoTool: "freehand" | "rect";
  spacebarPanRef: { readonly current: boolean };
  setLassoGeometry?: (geom: Polygon | MultiPolygon | null) => void;
  onApplyLassoSelection?: (coords: [number, number][], mode?: SelectionMode) => void;
  onApplyRectSelection?: (
    bounds: { west: number; south: number; east: number; north: number },
    mode?: SelectionMode
  ) => void;
}

/** Lasso / rectangular marquee click-and-drag selection. */
export function useMarqueeSelection({
  mapRef,
  isLoaded,
  mode,
  lassoTool,
  spacebarPanRef,
  setLassoGeometry,
  onApplyLassoSelection,
  onApplyRectSelection,
}: UseMarqueeSelectionProps) {
  const latest = useLatest({ mode, lassoTool });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const listeners = createListeners(map);

    let gesture: {
      isRect: boolean;
      selection: SelectionMode;
      startLngLat: [number, number];
      startPoint: { x: number; y: number };
      points: [number, number][];
    } | null = null;

    // The marquee is drawn straight into its GeoJSON source once per frame, no React state per move.
    let frame: number | null = null;
    let pending: Polygon | null = null;
    const scheduleLasso = (geom: Polygon | null) => {
      pending = geom;
      frame ??= requestAnimationFrame(() => {
        frame = null;
        getGeoJSONSource(map, "editor-lasso")?.setData(
          pending ? { type: "Feature", geometry: pending, properties: {} } : collection([])
        );
      });
    };

    listeners.onMap("mousedown", (e) => {
      if (spacebarPanRef.current) return;
      const shift = !!e.originalEvent?.shiftKey;
      const alt = !!e.originalEvent?.altKey;
      const marquee = marqueeFor(latest.current.mode, latest.current.lassoTool, shift, alt);
      if (!marquee) return;

      e.preventDefault();
      map.dragPan.disable();
      gesture = {
        ...marquee,
        startLngLat: [e.lngLat.lng, e.lngLat.lat],
        startPoint: { x: e.point.x, y: e.point.y },
        points: [],
      };
    });

    listeners.onMap("mousemove", (e) => {
      if (!gesture) return;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (gesture.isRect) {
        scheduleLasso(rectGeometry(gesture.startLngLat, lngLat));
        return;
      }

      const last = gesture.points.at(-1);
      // Skip sub-pixel jitter so long freehand loops stay light.
      if (last && Math.abs(last[0] - lngLat[0]) < 1e-6 && Math.abs(last[1] - lngLat[1]) < 1e-6) {
        return;
      }
      gesture.points.push(lngLat);
      if (gesture.points.length >= 2) {
        scheduleLasso({ type: "Polygon", coordinates: [[...gesture.points, gesture.points[0]!]] });
      }
    });

    listeners.onMap("mouseup", (e) => {
      if (!gesture) return;
      const { isRect, selection, startLngLat, startPoint, points } = gesture;
      gesture = null;
      map.dragPan.enable();

      const dragged = Math.hypot(e.point.x - startPoint.x, e.point.y - startPoint.y) > MIN_DRAG_PX;
      if (isRect) {
        if (dragged) {
          const end: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          onApplyRectSelection?.(
            {
              west: Math.min(startLngLat[0], end[0]),
              south: Math.min(startLngLat[1], end[1]),
              east: Math.max(startLngLat[0], end[0]),
              north: Math.max(startLngLat[1], end[1]),
            },
            selection
          );
        }
      } else if (points.length >= 3) {
        onApplyLassoSelection?.(points, selection);
      }
      scheduleLasso(null);
      setLassoGeometry?.(null);
    });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      listeners.dispose();
    };
  }, [
    mapRef,
    isLoaded,
    latest,
    spacebarPanRef,
    onApplyLassoSelection,
    onApplyRectSelection,
    setLassoGeometry,
  ]);
}
