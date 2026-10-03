import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { createListeners } from "./map-interaction";

/** A press that travels further than this (px) is a drag, so the click that follows is ignored. */
const DRAG_THRESHOLD_PX = 4;

/** Tracks whether the last pointer gesture was a drag; the ref is read by click handlers. */
export function useDragGesture(
  mapRef: { readonly current: MapLibreMap | null },
  isLoaded: boolean
) {
  const wasDragRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const listeners = createListeners(map);
    let down: { x: number; y: number } | null = null;

    listeners.onMap("mousedown", (e) => {
      down = { x: e.point.x, y: e.point.y };
      wasDragRef.current = false;
    });
    listeners.onMap("mouseup", (e) => {
      if (down && e.point) {
        wasDragRef.current = Math.hypot(e.point.x - down.x, e.point.y - down.y) > DRAG_THRESHOLD_PX;
      }
    });
    return () => listeners.dispose();
  }, [mapRef, isLoaded]);

  return wasDragRef;
}
