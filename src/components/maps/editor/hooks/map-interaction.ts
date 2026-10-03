import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { getFeatureCoords } from "../utils/map-helpers";

export type EditorMouseEvent = MapLayerMouseEvent & { routeClicked?: boolean };

/** True when the transport overlay already handled this click. */
export const isRouteClick = (e: EditorMouseEvent) =>
  !!(e.routeClicked || (e.originalEvent as MouseEvent & { routeClicked?: boolean })?.routeClicked);

/** Collects event bindings so an effect can undo all of them with one `dispose()`. */
export function createListeners(map: MapLibreMap) {
  const undo: Array<() => void> = [];
  return {
    onLayer(
      type: "mousedown" | "click" | "mouseenter" | "mouseleave",
      layerId: string,
      listener: (e: MapLayerMouseEvent) => void
    ) {
      map.on(type as "click", layerId, listener);
      undo.push(() => {
        try {
          map.off(type as "click", layerId, listener);
        } catch {
          // map already torn down
        }
      });
    },
    onMap(
      type: "mousemove" | "mouseup" | "contextmenu",
      listener: (e: MapLayerMouseEvent) => void
    ) {
      map.on(type as "mousemove", listener);
      undo.push(() => map.off(type as "mousemove", listener));
    },
    onDom<E extends Event>(
      target: EventTarget,
      type: string,
      listener: (e: E) => void,
      options?: AddEventListenerOptions
    ) {
      target.addEventListener(type, listener as EventListener, options);
      undo.push(() => target.removeEventListener(type, listener as EventListener));
    },
    dispose() {
      for (const unbind of undo) unbind();
    },
  };
}

/** Rendered features of the given layers within `radius` px of a point. */
export function queryNear(
  map: MapLibreMap,
  point: { x: number; y: number },
  radius: number,
  layers: string[]
) {
  return map.queryRenderedFeatures(
    [
      [point.x - radius, point.y - radius],
      [point.x + radius, point.y + radius],
    ],
    { layers }
  );
}

/** A client-space position expressed in the canvas's own pixel space. */
export function canvasPoint(canvas: HTMLElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export const LONG_PRESS_MS = 500;
/** A touch that travels further than this (px) is a drag, not a long press. */
export const LONG_PRESS_MOVE_PX = 8;

const MARKER_LAYERS = ["editor-points-capital", "editor-points-city", "editor-points-poi"];

/** The position of a city/POI marker within reach of the pointer, if any. */
export function nearbyMarker(
  map: MapLibreMap,
  point: { x: number; y: number }
): [number, number] | null {
  const hit = queryNear(map, point, 15, MARKER_LAYERS)[0];
  const coords = hit && getFeatureCoords(hit.geometry);
  return coords ? [coords[0], coords[1]] : null;
}
