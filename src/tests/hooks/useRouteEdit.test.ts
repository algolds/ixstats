/**
 * Route vertex editing shows a "copy" cursor over a midpoint (click inserts a vertex) and must
 * give the default cursor back when the pointer leaves it.
 */

import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useRouteEdit } from "~/components/maps/editor/hooks/useRouteEdit";

type Handler = (e?: unknown) => void;

function fakeMap() {
  const canvas = document.createElement("canvas");
  const layerHandlers = new Map<string, Handler>();
  const map = {
    getCanvas: () => canvas,
    getSource: () => undefined,
    getLayer: () => undefined,
    dragPan: { enable: jest.fn(), disable: jest.fn() },
    on: (type: string, layerOrFn: string | Handler, fn?: Handler) => {
      if (typeof layerOrFn === "string" && fn) layerHandlers.set(`${type}:${layerOrFn}`, fn);
    },
    off: jest.fn(),
  };
  return { map: map as unknown as MapLibreMap, canvas, layerHandlers };
}

describe("useRouteEdit midpoint cursor", () => {
  it("restores the default cursor when the pointer leaves a midpoint handle", () => {
    const { map, canvas, layerHandlers } = fakeMap();
    renderHook(() => useRouteEdit({ map, isLoaded: true, mode: "edit-route" }));

    layerHandlers.get("mouseenter:editor-route-edit-midpoints-layer")?.();
    expect(canvas.style.cursor).toBe("copy");

    layerHandlers.get("mouseleave:editor-route-edit-midpoints-layer")?.();
    expect(canvas.style.cursor).toBe("");
  });
});
