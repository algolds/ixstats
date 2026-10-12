import { renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import type { EditorFeature, EditorMode } from "~/hooks/useMapEditor";
import { useSubdivisionVertexEdit } from "~/components/maps/editor/hooks/useSubdivisionVertexEdit";

jest.mock("~/components/maps/editor/utils/map-helpers", () => {
  const actual = jest.requireActual<typeof import("~/components/maps/editor/utils/map-helpers")>(
    "~/components/maps/editor/utils/map-helpers"
  );
  return { ...actual, calculateOverlapGeoJson: jest.fn(actual.calculateOverlapGeoJson) };
});

import { calculateOverlapGeoJson } from "~/components/maps/editor/utils/map-helpers";

const overlap = jest.mocked(calculateOverlapGeoJson);

interface FakeEvent {
  point?: { x: number; y: number };
  lngLat?: { lng: number; lat: number };
  originalEvent?: { shiftKey: boolean };
  preventDefault?: () => void;
  features?: Array<{ properties: { ringIndex: number; vertexIndex: number }; geometry: Point }>;
}
type Handler = (e: FakeEvent) => void;

interface SourceDiff {
  update: Array<{ id: string; newGeometry: Polygon }>;
}
interface FakeSource {
  setData: jest.Mock<Promise<void>, [FeatureCollection]>;
  updateData: jest.Mock<Promise<void>, [SourceDiff]>;
}

/** A map that records its handlers and hands out one fake GeoJSON source per id. */
function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const on = (type: string, layerOrFn: string | Handler, fn?: Handler) => {
    const key = typeof layerOrFn === "string" ? `${type}:${layerOrFn}` : type;
    const handler = typeof layerOrFn === "string" ? fn! : layerOrFn;
    handlers.set(key, [...(handlers.get(key) ?? []), handler]);
  };
  const sources = new Map<string, FakeSource>();
  const source = (id: string): FakeSource => {
    let s = sources.get(id);
    if (!s) {
      s = {
        setData: jest.fn<Promise<void>, [FeatureCollection]>(() => Promise.resolve()),
        updateData: jest.fn<Promise<void>, [SourceDiff]>(() => Promise.resolve()),
      };
      sources.set(id, s);
    }
    return s;
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
        if (name === "getSource") return source;
        if (name === "getLayer") return () => undefined;
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  const fire = (key: string, e: FakeEvent) => handlers.get(key)?.forEach((h) => h(e));
  return { map, fire, source };
}

/** A requestAnimationFrame the test steps by hand; one call runs every frame requested so far. */
function controlledFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queue.set(next, cb);
    return next++;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => void queue.delete(id));
  return () => {
    // Work scheduled by a frame (the cascade repaint) runs in the frame after it
    for (let pass = 0; pass < 3 && queue.size > 0; pass++) {
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((cb) => cb(0));
    }
  };
}

const square = (x: number, y: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

const region = (id: string, geometry: Polygon | MultiPolygon): EditorFeature => ({
  id,
  type: "subdivision",
  name: id,
  geometry,
  properties: {},
});

const A = region("region-a", square(0, 0));
/** Shares the edge x = 1 with A, so the vertex [1, 1] belongs to both. */
const B = region("region-b", square(1, 0));
/** Nowhere near A. */
const C = region("region-c", square(10, 10));
const FEATURES = [A, B, C];

/** A pointer event far enough from the grab point to commit the drag. */
const move = (x: number, lng: number, lat: number): FakeEvent => ({
  point: { x, y: 0 },
  lngLat: { lng, lat },
  originalEvent: { shiftKey: false },
});

function setup(initialMode: EditorMode = "edit-subdivision") {
  jest.useFakeTimers();
  const frames = controlledFrames();
  const { map, fire, source } = fakeMap();
  const rendered = renderHook(
    ({ mode }: { mode: EditorMode }) =>
      useSubdivisionVertexEdit({
        map,
        isLoaded: true,
        mode,
        selectedFeature: A,
        features: FEATURES,
        countryGeometry: null,
        snapEnabled: false,
      }),
    { initialProps: { mode: initialMode } }
  );
  overlap.mockClear();
  // Grab A's vertex at [1, 1], which B shares
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
  return { frames, fire, source, ...rendered };
}

const mouseUp = () => window.dispatchEvent(new MouseEvent("mouseup"));
const escape = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("region reshape overlap check", () => {
  it("runs no overlap check while dragging, then one on mouse-up against the regions sharing a vertex", () => {
    const { frames, fire, source } = setup();

    for (let i = 0; i < 10; i++) {
      fire("mousemove", move(20 + i * 10, 2 + i * 0.1, 2));
      frames();
      jest.advanceTimersByTime(150);
    }
    expect(overlap).not.toHaveBeenCalled();
    // The add-vertex handles still follow the edge while dragging
    expect(source("editor-vedit-midpoints").setData).toHaveBeenCalled();

    mouseUp();
    expect(overlap).toHaveBeenCalledTimes(1);
    const [, checked, editedId] = overlap.mock.calls[0]!;
    expect(checked.map((f) => f.id)).toEqual(["region-b"]);
    expect(editedId).toBe("region-a");
  });

  it("checks the neighbour where the cascade left it, not where it was saved", () => {
    const { frames, fire } = setup();

    fire("mousemove", move(20, 3, 3));
    frames();
    mouseUp();

    const checked = overlap.mock.calls[0]![1];
    expect((checked[0]!.geometry as Polygon).coordinates[0]![3]).toEqual([3, 3]);
  });
});

describe("cascaded neighbours on MapLibre 6", () => {
  it("moves a neighbour through updateData by region id, never through setData", () => {
    const { frames, fire, source } = setup();

    fire("mousemove", move(20, 3, 3));
    frames();

    const subdivisions = source("editor-subdivisions");
    expect(subdivisions.setData).not.toHaveBeenCalled();
    expect(subdivisions.updateData).toHaveBeenCalledTimes(1);
    const { update } = subdivisions.updateData.mock.calls[0]![0];
    expect(update.map((u) => u.id)).toEqual(["region-b"]);
    expect(update[0]!.newGeometry.coordinates[0]![3]).toEqual([3, 3]);
  });

  it("sends the moves of several mouse events in one frame as one updateData", () => {
    const { frames, fire, source } = setup();

    fire("mousemove", move(20, 2, 2));
    fire("mousemove", move(40, 3, 3));
    frames();

    expect(source("editor-subdivisions").updateData).toHaveBeenCalledTimes(1);
  });

  it("puts the neighbour back through updateData when Escape cancels the drag", () => {
    const { frames, fire, source } = setup();
    fire("mousemove", move(20, 3, 3));
    frames();
    const subdivisions = source("editor-subdivisions");
    subdivisions.updateData.mockClear();

    escape();
    frames();

    expect(subdivisions.updateData).toHaveBeenCalledTimes(1);
    expect(subdivisions.updateData.mock.calls[0]![0]).toEqual({
      update: [{ id: "region-b", newGeometry: B.geometry }],
    });
    expect(subdivisions.setData).not.toHaveBeenCalled();
  });

  it("puts reshaped neighbours back through updateData when the edit is cancelled", () => {
    const { frames, fire, source, rerender } = setup();
    fire("mousemove", move(20, 3, 3));
    frames();
    mouseUp();
    const subdivisions = source("editor-subdivisions");
    subdivisions.updateData.mockClear();

    rerender({ mode: "view" });
    frames();

    expect(subdivisions.updateData).toHaveBeenCalledTimes(1);
    expect(subdivisions.updateData.mock.calls[0]![0]).toEqual({
      update: [{ id: "region-b", newGeometry: B.geometry }],
    });
  });
});

describe("source access", () => {
  it("never reads a source's private data cache", () => {
    const { frames, fire, source } = setup();
    const readCache = jest.fn();
    // MapLibre 6 keeps { geojson } there, so a reader of `_data.features` finds nothing
    Object.defineProperty(source("editor-subdivisions"), "_data", {
      get() {
        readCache();
        return { geojson: { type: "FeatureCollection", features: [] } };
      },
    });

    fire("mousemove", move(20, 3, 3));
    frames();

    expect(readCache).not.toHaveBeenCalled();
  });
});
