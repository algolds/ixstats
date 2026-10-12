import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { usePointDrag } from "~/components/maps/editor/hooks/usePointDrag";

interface FakeEvent {
  point: { x: number; y: number };
  lngLat?: { lng: number; lat: number };
  originalEvent?: { shiftKey: boolean };
  preventDefault?: () => void;
}
type Handler = (e: FakeEvent) => void;

/** A map that records its handlers and has one points source whose setData the test can count. */
function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const on = (type: string, layerOrFn: string | Handler, fn?: Handler) => {
    const key = typeof layerOrFn === "string" ? `${type}:${layerOrFn}` : type;
    const handler = typeof layerOrFn === "string" ? fn! : layerOrFn;
    handlers.set(key, [...(handlers.get(key) ?? []), handler]);
  };
  const points = { setData: jest.fn<void, [FeatureCollection]>() };
  const canvas = document.createElement("canvas");
  const methods = new Map<string, jest.Mock>();
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === "on") return on;
        if (name === "getCanvas") return () => canvas;
        if (name === "dragPan") return { enable: () => {}, disable: () => {} };
        if (name === "getSource")
          return (id: string) => (id === "editor-points" ? points : undefined);
        if (name === "getLayer") return () => undefined;
        if (name === "queryRenderedFeatures") return () => [{ properties: { id: "c1" } }];
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  const fire = (key: string, e: FakeEvent) => handlers.get(key)?.forEach((h) => h(e));
  return { map, fire, points };
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

const city: EditorFeature = {
  id: "c1",
  type: "city",
  name: "Port",
  coordinates: [10, 20],
  properties: {},
};
const other: EditorFeature = {
  id: "c2",
  type: "city",
  name: "Harbour",
  coordinates: [30, 40],
  properties: {},
};

/** A pointer event far enough from the grab point (x = 0) to commit the drag. */
const move = (x: number, lng: number, lat: number): FakeEvent => ({
  point: { x, y: 0 },
  lngLat: { lng, lat },
  originalEvent: { shiftKey: false },
});

function setup(updatePointCoordinates = jest.fn().mockResolvedValue(undefined)) {
  const frame = controlledFrames();
  const { map, fire, points } = fakeMap();
  renderHook(() =>
    usePointDrag({
      map,
      isLoaded: true,
      mode: "view",
      features: [city, other],
      selectedFeature: city,
      updatePointCoordinates,
    })
  );
  fire("mousedown:editor-points-city", {
    point: { x: 0, y: 0 },
    preventDefault: () => {},
  });
  // Grabbing the point does not touch the source; only the drag's own updates are counted
  points.setData.mockClear();
  return { frame, fire, points, updatePointCoordinates };
}

const lastDragged = (points: { setData: jest.Mock<void, [FeatureCollection]> }) => {
  const data = points.setData.mock.lastCall![0];
  return data.features.find((f) => f.properties?.id === "c1")!.geometry;
};

afterEach(() => jest.restoreAllMocks());

describe("usePointDrag source updates", () => {
  it("sends the points source once per frame, however many mouse events arrive", () => {
    const { frame, fire, points } = setup();

    for (let i = 1; i <= 5; i++) fire("mousemove", move(10 * i, 10 + i, 20 + i));
    expect(points.setData).not.toHaveBeenCalled();

    frame();
    expect(points.setData).toHaveBeenCalledTimes(1);
    expect(lastDragged(points)).toEqual({ type: "Point", coordinates: [15, 25] });
  });

  it("sends one update per frame while the drag goes on", () => {
    const { frame, fire, points } = setup();

    fire("mousemove", move(10, 11, 21));
    frame();
    fire("mousemove", move(20, 12, 22));
    fire("mousemove", move(30, 13, 23));
    frame();

    expect(points.setData).toHaveBeenCalledTimes(2);
    expect(lastDragged(points)).toEqual({ type: "Point", coordinates: [13, 23] });
  });

  it("lands the point where the pointer stopped, even if its frame has not run", () => {
    const { frame, fire, points, updatePointCoordinates } = setup();

    fire("mousemove", move(10, 11, 21));
    frame();
    fire("mousemove", move(20, 12, 22));
    window.dispatchEvent(new MouseEvent("mouseup"));
    frame();

    expect(lastDragged(points)).toEqual({ type: "Point", coordinates: [12, 22] });
    expect(updatePointCoordinates).toHaveBeenCalledWith("c1", "city", [12, 22]);
  });

  it("drops the pending frame on Escape and puts the points back once", () => {
    const { frame, fire, points } = setup();

    fire("mousemove", move(10, 11, 21));
    frame();
    fire("mousemove", move(20, 12, 22));
    points.setData.mockClear();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    frame();

    expect(points.setData).toHaveBeenCalledTimes(1);
    expect(lastDragged(points)).toEqual({ type: "Point", coordinates: [10, 20] });
  });
});
