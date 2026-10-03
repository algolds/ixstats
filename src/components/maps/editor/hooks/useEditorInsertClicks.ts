import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorMode } from "~/hooks/useMapEditor";
import {
  createListeners,
  isRouteClick,
  nearbyMarker,
  type EditorMouseEvent,
} from "./map-interaction";
import { useLatest } from "./useLatest";

/** Modes where a click drops a snapped point (city/POI/peak/split line). */
const POINT_CLICK_MODES = new Set<EditorMode>([
  "add-city",
  "add-poi",
  "add-peak",
  "split-subdivision",
]);

interface UseEditorInsertClicksProps {
  mapRef: { readonly current: MapLibreMap | null };
  isLoaded: boolean;
  isVertexEditing: boolean;
  mode: EditorMode;
  snapPoint: (coords: [number, number]) => [number, number];
  spacebarPanRef: { readonly current: boolean };
  wasDragRef: { readonly current: boolean };
  onMapClick: (lng: number, lat: number) => void;
  onAddRulerPoint?: (coords: [number, number]) => void;
}

/** Map clicks that insert things: points, split lines, ruler points, route/river waypoints. */
export function useEditorInsertClicks({
  mapRef,
  isLoaded,
  isVertexEditing,
  mode,
  snapPoint,
  spacebarPanRef,
  wasDragRef,
  onMapClick,
  onAddRulerPoint,
}: UseEditorInsertClicksProps) {
  const latest = useLatest({ mode, onMapClick });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const listeners = createListeners(map);

    listeners.onMap("click", (e: EditorMouseEvent) => {
      if (e.defaultPrevented || spacebarPanRef.current || isRouteClick(e) || isVertexEditing)
        return;
      // Post-drag clicks (map pan) must not place anything.
      if (wasDragRef.current) return;

      const { mode: currentMode, onMapClick: click } = latest.current;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (POINT_CLICK_MODES.has(currentMode)) {
        const snapped = snapPoint(lngLat);
        click(snapped[0], snapped[1]);
      } else if (currentMode === "ruler") {
        onAddRulerPoint?.(snapPoint(lngLat));
      } else if (currentMode === "add-route" || currentMode === "add-river") {
        // Waypoints snap to a nearby marker first, then to the guides.
        const point = nearbyMarker(map, e.point) ?? snapPoint(lngLat);
        click(point[0], point[1]);
      }
    });

    return () => listeners.dispose();
  }, [
    mapRef,
    isLoaded,
    isVertexEditing,
    onAddRulerPoint,
    snapPoint,
    latest,
    spacebarPanRef,
    wasDragRef,
  ]);
}
