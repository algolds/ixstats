import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useBorderEditorLayers } from "~/components/maps/editor/hooks/useBorderEditorLayers";

type Handler = (e: unknown) => void;

/** A map that records its event handlers so the test can fire them; everything else is a no-op. */
function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const on = (type: string, layerOrFn: string | Handler, fn?: Handler) => {
    const key = typeof layerOrFn === "string" ? `${type}:${layerOrFn}` : type;
    handlers.set(key, [...(handlers.get(key) ?? []), (fn ?? layerOrFn) as Handler]);
  };
  const canvas = document.createElement("canvas");
  const container = document.createElement("div");
  const methods = new Map<string, jest.Mock>();
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "on") return on;
        if (name === "getCanvas") return () => canvas;
        if (name === "getContainer") return () => container;
        if (name === "dragPan") return { enable: () => {}, disable: () => {} };
        if (name === "getSource" || name === "getLayer") return () => undefined;
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  const fire = (key: string, e: unknown) => handlers.get(key)?.forEach((h) => h(e));
  return { map, fire };
}

/** A requestAnimationFrame the test steps by hand. */
function controlledFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queue.set(next, cb);
    return next++;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => void queue.delete(id));
  return () => {
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((cb) => cb(0));
  };
}

const at = (lng: number, lat: number) => ({
  lngLat: { lng, lat },
  point: { x: 0, y: 0 },
  preventDefault: () => {},
});

afterEach(() => jest.restoreAllMocks());

describe("useBorderEditorLayers vertex drag", () => {
  function setup() {
    const frame = controlledFrames();
    const { map, fire } = fakeMap();
    const onVertexDrag = jest.fn();
    const onDragEnd = jest.fn();
    renderHook(() =>
      useBorderEditorLayers({
        map,
        isActive: true,
        geometry: null,
        mode: "vertex_edit",
        splitLine: [],
        mergeTargets: [],
        selectedVertex: null,
        onMapClick: () => {},
        onVertexDrag,
        onDragEnd,
      })
    );
    fire("mousedown:vertices-circles", {
      ...at(0, 0),
      features: [{ properties: { ringIndex: 0, vertexIndex: 3 } }],
    });
    return { frame, fire, onVertexDrag, onDragEnd };
  }

  it("moves the vertex once per frame, to the latest pointer position", () => {
    const { frame, fire, onVertexDrag } = setup();
    fire("mousemove", at(1, 1));
    fire("mousemove", at(2, 2));
    expect(onVertexDrag).not.toHaveBeenCalled();

    frame();
    expect(onVertexDrag).toHaveBeenCalledTimes(1);
    expect(onVertexDrag.mock.calls[0]![1]).toEqual([2, 2]);
  });

  it("applies the last move on mouse-up, before the drag ends", () => {
    const { frame, fire, onVertexDrag, onDragEnd } = setup();
    fire("mousemove", at(1, 1));
    fire("mousemove", at(3, 4));
    fire("mouseup", {});

    expect(onVertexDrag).toHaveBeenCalledTimes(1);
    expect(onVertexDrag.mock.calls[0]![1]).toEqual([3, 4]);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd.mock.invocationCallOrder[0]).toBeGreaterThan(
      onVertexDrag.mock.invocationCallOrder[0]!
    );

    frame();
    expect(onVertexDrag).toHaveBeenCalledTimes(1);
  });
});
