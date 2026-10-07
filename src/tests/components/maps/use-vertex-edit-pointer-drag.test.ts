import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon } from "geojson";
import {
  createVertexEditState,
  useVertexEditPointer,
  type VertexEditLatest,
} from "~/components/maps/editor/hooks/useVertexEditPointer";

type Handler = (e: unknown) => void;

/** A map that records its event handlers so the test can fire them; everything else is a no-op. */
function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const on = (type: string, layerOrFn: string | Handler, fn?: Handler) => {
    const key = typeof layerOrFn === "string" ? `${type}:${layerOrFn}` : type;
    handlers.set(key, [...(handlers.get(key) ?? []), (fn ?? layerOrFn) as Handler]);
  };
  const canvas = document.createElement("canvas");
  const methods = new Map<string, jest.Mock>();
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "on") return on;
        if (name === "getCanvas") return () => canvas;
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

const square = (): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
});

/** A pointer event at screen x (far enough from the start to commit the drag) and map lng/lat. */
const move = (x: number, lng: number, lat: number) => ({
  point: { x, y: 0 },
  lngLat: { lng, lat },
  originalEvent: { shiftKey: false },
});

afterEach(() => jest.restoreAllMocks());

function setup() {
  const frame = controlledFrames();
  const { map, fire } = fakeMap();
  const st = createVertexEditState();
  st.edit = { featureId: "region-1", currentGeometry: square() };
  const latest: { current: VertexEditLatest } = {
    current: { features: [], countryGeometry: null, snapEnabled: false },
  };
  renderHook(() =>
    useVertexEditPointer({
      map,
      isLoaded: true,
      st,
      latest,
      updateVertexEditVis: () => {},
      scheduleThrottledUpdate: () => {},
      queueCascadeVisual: () => {},
    })
  );
  // Grab the vertex at [1, 1]
  fire("mousedown:editor-vedit-vertices-layer", {
    point: { x: 0, y: 0 },
    preventDefault: () => {},
    features: [
      {
        properties: { ringIndex: 0, vertexIndex: 2 },
        geometry: { type: "Point", coordinates: [1, 1] },
      },
    ],
  });
  const vertex = () => (st.edit!.currentGeometry as Polygon).coordinates[0]![2];
  return { frame, fire, st, vertex };
}

describe("useVertexEditPointer drag", () => {
  it("moves the vertex once per frame, to the latest pointer position", () => {
    const { frame, fire, vertex } = setup();
    fire("mousemove", move(20, 2, 2));
    fire("mousemove", move(40, 3, 3));
    expect(vertex()).toEqual([1, 1]);

    frame();
    expect(vertex()).toEqual([3, 3]);
  });

  it("applies the last move on mouse-up, so the vertex lands where the pointer stopped", () => {
    const { frame, fire, st, vertex } = setup();
    fire("mousemove", move(20, 2, 2));
    frame();
    fire("mousemove", move(40, 5, 6));
    window.dispatchEvent(new MouseEvent("mouseup"));

    expect(vertex()).toEqual([5, 6]);
    expect(st.drag).toBeNull();
  });

  it("Escape restores the shape and drops the pending move", () => {
    const { frame, fire, vertex } = setup();
    fire("mousemove", move(20, 2, 2));
    frame();
    fire("mousemove", move(40, 9, 9));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    frame();

    expect(vertex()).toEqual([1, 1]);
  });
});
