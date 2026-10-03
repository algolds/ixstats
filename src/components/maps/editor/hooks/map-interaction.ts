import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { getFeatureCoords } from "../utils/map-helpers";

export type EditorMouseEvent = MapLayerMouseEvent & { routeClicked?: boolean };
type MouseListener = (e: EditorMouseEvent) => void;

/** True when the transport overlay already handled this click. */
export const isRouteClick = (e: EditorMouseEvent) =>
  !!(e.routeClicked || (e.originalEvent as MouseEvent & { routeClicked?: boolean })?.routeClicked);

/** Collects event bindings so an effect can undo all of them with one `dispose()`. */
export function createListeners(map: MapLibreMap) {
  const undo: Array<() => void> = [];
  function onDom<E extends Event>(
    target: EventTarget,
    type: string,
    listener: (e: E) => void,
    options?: AddEventListenerOptions
  ) {
    target.addEventListener(type, listener as EventListener, options);
    undo.push(() => target.removeEventListener(type, listener as EventListener));
  }
  return {
    onLayer(
      type: "mousedown" | "click" | "mouseenter" | "mouseleave",
      layerId: string,
      listener: MouseListener
    ) {
      const bound = listener as (e: MapLayerMouseEvent) => void;
      map.on(type as "click", layerId, bound);
      undo.push(() => {
        try {
          map.off(type as "click", layerId, bound);
        } catch {
          // map already torn down
        }
      });
    },
    onMap(
      type: "mousemove" | "mouseup" | "mousedown" | "click" | "contextmenu",
      listener: MouseListener
    ) {
      const bound = listener as (e: MapLayerMouseEvent) => void;
      map.on(type as "mousemove", bound);
      undo.push(() => map.off(type as "mousemove", bound));
    },
    onDom,
    /** touchstart/touchmove are non-passive so handlers can cancel page scrolling. */
    onTouch(
      target: EventTarget,
      handlers: { start: (e: TouchEvent) => void; move: (e: TouchEvent) => void; end: () => void }
    ) {
      onDom(target, "touchstart", handlers.start, { passive: false });
      onDom(target, "touchmove", handlers.move, { passive: false });
      onDom(target, "touchend", handlers.end);
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

const LONG_PRESS_MS = 500;
/** A touch that travels further than this (px) is a drag, not a long press. */
const LONG_PRESS_MOVE_PX = 8;

/** Long-press detection for touch: `begin` on touchstart, `arm` on a hit, `move`/`end` follow the touch. */
export function createLongPress() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origin: { x: number; y: number } | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    begin(point: { x: number; y: number }) {
      origin = point;
    },
    arm(onLongPress: () => void) {
      timer = setTimeout(onLongPress, LONG_PRESS_MS);
    },
    move(point: { x: number; y: number }) {
      if (
        timer &&
        origin &&
        Math.hypot(point.x - origin.x, point.y - origin.y) > LONG_PRESS_MOVE_PX
      ) {
        cancel();
      }
    },
    end() {
      cancel();
      origin = null;
    },
    cancel,
  };
}

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
