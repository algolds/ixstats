import { renderHook } from "@testing-library/react";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useBorderEditorLayers } from "~/components/maps/editor/hooks/useBorderEditorLayers";
import type { BorderDragFrame } from "~/lib/maps/border-drag";

type Handler = (e: unknown) => void;
type Shape = Polygon | MultiPolygon;

interface FakeSource {
  spec: { promoteId?: string };
  setData: jest.Mock;
}

/** A map that records its event handlers and sources so the test can fire and inspect them. */
function fakeMap() {
  const handlers = new Map<string, Handler[]>();
  const on = (type: string, layerOrFn: string | Handler, fn?: Handler) => {
    const key = typeof layerOrFn === "string" ? `${type}:${layerOrFn}` : type;
    handlers.set(key, [...(handlers.get(key) ?? []), (fn ?? layerOrFn) as Handler]);
  };
  const canvas = document.createElement("canvas");
  const container = document.createElement("div");
  const sources = new Map<string, FakeSource>();
  const methods = new Map<string, jest.Mock>();
  const overrides: Record<string, unknown> = {
    on,
    getCanvas: () => canvas,
    getContainer: () => container,
    dragPan: { enable: () => {}, disable: () => {} },
    isStyleLoaded: () => true,
    getSource: (id: string) => sources.get(id),
    getLayer: () => undefined,
    addSource: (id: string, spec: FakeSource["spec"]) =>
      void sources.set(id, { spec, setData: jest.fn() }),
    removeSource: (id: string) => void sources.delete(id),
  };
  const map = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name in overrides) return overrides[name];
        if (!methods.has(name)) methods.set(name, jest.fn());
        return methods.get(name);
      },
    }
  ) as unknown as MapLibreMap;
  const fire = (key: string, e: unknown) => handlers.get(key)?.forEach((h) => h(e));
  const source = (id: string) => sources.get(id)!;
  const method = (name: string) => (map as unknown as Record<string, jest.Mock>)[name]!;
  /** The data each setData call on a source was given. */
  const sent = (id: string) => source(id).setData.mock.calls.map((c) => c[0] as FeatureCollection);
  const resetCalls = () => sources.forEach((s) => s.setData.mockClear());
  return { map, fire, source, method, sent, resetCalls };
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

const square = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
  ],
});

afterEach(() => jest.restoreAllMocks());

type Props = Parameters<typeof useBorderEditorLayers>[0];

describe("useBorderEditorLayers vertex drag", () => {
  function setup(over: Partial<Props> = {}) {
    const frame = controlledFrames();
    const fake = fakeMap();
    const onVertexDrag = jest.fn();
    const onDragEnd = jest.fn();
    const props: Props = {
      map: fake.map,
      isActive: true,
      geometry: null,
      mode: "vertex_edit",
      splitLine: [],
      mergeTargets: [],
      selectedVertex: null,
      onMapClick: () => {},
      onVertexDrag,
      onDragEnd,
      ...over,
    };
    const hook = renderHook((p: Props) => useBorderEditorLayers(p), { initialProps: props });
    fake.fire("mousedown:vertices-circles", {
      ...at(0, 0),
      features: [{ properties: { ringIndex: 0, vertexIndex: 3 } }],
    });
    return { ...fake, frame, onVertexDrag, onDragEnd, props, ...hook };
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

describe("useBorderEditorLayers border drag source", () => {
  const OUTLINE = square(0, 0, 4, 4);
  const frameAt = (lng: number): BorderDragFrame => ({
    geometry: square(0, 0, lng, 4),
    vertex: [lng, 4],
    edges: [
      [
        [0, 4],
        [lng, 4],
        [lng, 0],
      ],
    ],
  });

  function setup(over: Partial<Props> = {}) {
    const frame = controlledFrames();
    const fake = fakeMap();
    let lng = 4;
    const onVertexDrag = jest.fn(() => frameAt(++lng));
    const onDragEnd = jest.fn(() => true);
    const props: Props = {
      map: fake.map,
      isActive: true,
      geometry: OUTLINE,
      mode: "vertex_edit",
      splitLine: [],
      mergeTargets: [],
      selectedVertex: null,
      onMapClick: () => {},
      onVertexDrag,
      onDragEnd,
      ...over,
    };
    const hook = renderHook((p: Props) => useBorderEditorLayers(p), { initialProps: props });
    fake.resetCalls();
    return { ...fake, frame, onVertexDrag, onDragEnd, props, ...hook };
  }

  const startDrag = (fire: (key: string, e: unknown) => void) =>
    fire("mousedown:vertices-circles", {
      ...at(4, 4),
      features: [{ properties: { ringIndex: 0, vertexIndex: 2 } }],
    });

  it("keys the vertices source on a vertex id so a vertex can be styled by feature-state", () => {
    const { source } = setup();
    expect(source("vertices").spec.promoteId).toBe("vid");
  });

  it("sends the full vertex and midpoint sources nothing while the vertex moves", () => {
    const { fire, frame, sent } = setup();
    startDrag(fire);

    for (let i = 0; i < 60; i++) {
      fire("mousemove", at(4 + i * 0.01, 4));
      frame();
    }

    expect(sent("vertices")).toHaveLength(0);
    expect(sent("midpoints")).toHaveLength(0);
    expect(sent("border-drag").length).toBeLessThanOrEqual(60);
    expect(sent("border-drag").length).toBe(60);
  });

  it("draws only the dragged vertex and the edges around it in the drag source", () => {
    const { fire, frame, sent } = setup();
    startDrag(fire);
    fire("mousemove", at(4.5, 4));
    frame();

    const [drag] = sent("border-drag").slice(-1);
    expect(drag!.features.map((f) => f.geometry.type)).toEqual(["Point", "LineString"]);
    expect(drag!.features[0]!.geometry).toEqual({ type: "Point", coordinates: [5, 4] });
  });

  it("redraws the edited outline with the drag, from the geometry it was handed", () => {
    const { fire, frame, sent } = setup();
    startDrag(fire);
    fire("mousemove", at(4.5, 4));
    frame();

    const [outline] = sent("active-feature").slice(-1);
    expect(outline!.features[0]!.geometry).toEqual(square(0, 0, 5, 4));
  });

  it("rebuilds the vertex and midpoint sources once when the drag commits, and clears the overlay", () => {
    const { fire, frame, sent, rerender, props } = setup();
    startDrag(fire);
    for (let i = 0; i < 5; i++) {
      fire("mousemove", at(4 + i * 0.01, 4));
      frame();
    }
    fire("mouseup", {});
    // The overlay holds until the committed outline reaches the vertex source
    expect(sent("border-drag").slice(-1)[0]!.features.length).toBeGreaterThan(0);

    rerender({ ...props, geometry: square(0, 0, 9, 4) });

    expect(sent("vertices")).toHaveLength(1);
    expect(sent("midpoints")).toHaveLength(1);
    expect(sent("vertices")[0]!.features).toHaveLength(4);
    expect(sent("border-drag").slice(-1)[0]!.features).toHaveLength(0);
  });

  it("clears the overlay on release when the drag changed nothing", () => {
    const { fire, frame, sent, onDragEnd } = setup();
    onDragEnd.mockReturnValue(false);
    startDrag(fire);
    fire("mousemove", at(4.5, 4));
    frame();

    fire("mouseup", {});

    expect(sent("border-drag").slice(-1)[0]!.features).toHaveLength(0);
  });

  it("hides the vertex being dragged and shows it again once the drag is over", () => {
    const { fire, frame, method, rerender, props } = setup();
    startDrag(fire);
    fire("mousemove", at(4.5, 4));
    frame();
    expect(method("setFeatureState")).toHaveBeenCalledWith(
      { source: "vertices", id: "0:2" },
      { dragging: true }
    );

    fire("mouseup", {});
    rerender({ ...props, geometry: square(0, 0, 9, 4) });
    expect(method("removeFeatureState")).toHaveBeenCalledWith(
      { source: "vertices", id: "0:2" },
      "dragging"
    );
  });

  it("styles the selected vertex by feature-state, not by a property on every feature", () => {
    const { sent, method, rerender, props } = setup();
    rerender({ ...props, selectedVertex: { ringIndex: 0, vertexIndex: 1, coord: [4, 0] } });

    expect(method("setFeatureState")).toHaveBeenCalledWith(
      { source: "vertices", id: "0:1" },
      { selected: true }
    );
    // Selecting a vertex is not a reason to resend the vertex source
    expect(sent("vertices")).toHaveLength(0);

    rerender({ ...props, geometry: square(0, 0, 9, 4) });
    const [vertices] = sent("vertices").slice(-1);
    expect(vertices!.features[0]!.properties).toEqual({ ringIndex: 0, vertexIndex: 0, vid: "0:0" });
  });

  it("moves the selection mark when another vertex is selected", () => {
    const { method, rerender, props } = setup({
      selectedVertex: { ringIndex: 0, vertexIndex: 1, coord: [4, 0] },
    });
    rerender({ ...props, selectedVertex: { ringIndex: 0, vertexIndex: 2, coord: [4, 4] } });

    expect(method("removeFeatureState")).toHaveBeenCalledWith(
      { source: "vertices", id: "0:1" },
      "selected"
    );
    expect(method("setFeatureState")).toHaveBeenCalledWith(
      { source: "vertices", id: "0:2" },
      { selected: true }
    );
  });
});

describe("useBorderEditorLayers neighbours", () => {
  const A = square(0, 0, 1, 1);
  const B = square(1, 0, 2, 1);

  function setup(neighborGeometries: Record<string, Shape>) {
    const fake = fakeMap();
    const props: Props = {
      map: fake.map,
      isActive: true,
      geometry: A,
      neighborGeometries,
      mode: "vertex_edit",
      splitLine: [],
      mergeTargets: [],
      selectedVertex: null,
      onMapClick: () => {},
      onVertexDrag: () => null,
    };
    const hook = renderHook((p: Props) => useBorderEditorLayers(p), { initialProps: props });
    return { ...fake, props, ...hook };
  }

  const firstRing = (fc: FeatureCollection, index: number): Position[] =>
    (fc.features[index]!.geometry as Polygon).coordinates[0]!;

  it("draws the neighbours from the editor's own geometries", () => {
    const { sent } = setup({ B });
    const [drawn] = sent("neighbors").slice(-1);
    expect(drawn!.features).toHaveLength(1);
    expect(drawn!.features[0]!.properties).toEqual({ id: "B" });
    expect(firstRing(drawn!, 0)[0]).toEqual([1, 0]);
  });

  it("redraws a neighbour that a shared-vertex drag moved", () => {
    const { sent, rerender, props } = setup({ B });
    const moved: Polygon = {
      type: "Polygon",
      coordinates: [[[1.2, -0.1], ...B.coordinates[0]!.slice(1, 4), [1.2, -0.1]]],
    };

    rerender({ ...props, neighborGeometries: { B: moved } });

    const [drawn] = sent("neighbors").slice(-1);
    expect(firstRing(drawn!, 0)[0]).toEqual([1.2, -0.1]);
  });

  it("draws the merge targets from the same geometries", () => {
    const { sent, rerender, props } = setup({ B });
    rerender({ ...props, mergeTargets: ["B"] });
    expect(sent("merge-targets").slice(-1)[0]!.features).toHaveLength(1);
  });
});
