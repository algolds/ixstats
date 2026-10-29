/**
 * The border editor: a vertex drag carries exactly the neighbours that share the vertex, into the state, the saved
 * draft and the undo history; Escape puts them back mid-drag; a ring stays closed when its first vertex moves; an arrow
 * nudge records where the point was. The autosaved draft stays small on a big outline. A draft is offered only to its
 * own user and only while newer than the saved border; restoring it moves only real neighbours and revert brings the
 * saved border back; a discarded draft is not offered again, and the prompt asks once. GeoJSON export imports again.
 * (Which neighbours a restored draft keeps on the server is in src/tests/scenarios/maps/country-claim-map-version.test.ts.)
 *
 * Folds: src/tests/lib/maps/border-draft.test.ts, src/tests/lib/maps/border-drag.test.ts,
 * src/tests/lib/maps/border-editor-move-vertex.test.ts, src/tests/components/maps/use-border-draft-prompt.test.ts,
 * src/tests/components/maps/use-point-drag-nudge.test.ts, src/tests/components/maps/use-vertex-edit-pointer-drag.test.ts,
 * src/tests/hooks/editor-geo-ops.test.ts
 */
import { act, renderHook } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MultiPolygon, Polygon, Position } from "geojson";

jest.mock("~/trpc/react", () => {
  const mutation = () => ({ mutate: jest.fn(), mutateAsync: jest.fn().mockResolvedValue({}) });
  const mutations = {
    startBorderEditSession: mutation(),
    saveBorderEditDraft: mutation(),
    submitBorderEdit: mutation(),
    splitCountry: mutation(),
    mergeCountries: mutation(),
    repairBorderGeometry: mutation(),
  };
  const invalidate = jest.fn().mockResolvedValue(undefined);
  const utils = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate }) }) });
  return {
    mutations,
    api: {
      geoEditor: Object.fromEntries(
        Object.entries(mutations).map(([name, m]) => [name, { useMutation: () => m }])
      ),
      useUtils: () => utils,
    },
  };
});
jest.mock("~/lib/maps/territory-brush", () => ({ applyBrushStroke: jest.fn() }));
jest.mock("~/components/maps/editor/components/EditorConfirmDialog", () => ({
  confirmEditorAction: jest.fn(),
}));

import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import { useBorderDraftPrompt } from "~/components/maps/editor/hooks/useBorderDraftPrompt";
import { NUDGE_SMALL } from "~/components/maps/editor/hooks/drag-utils";
import { usePointDrag } from "~/components/maps/editor/hooks/usePointDrag";
import {
  createVertexEditState,
  useVertexEditPointer,
  type VertexEditLatest,
} from "~/components/maps/editor/hooks/useVertexEditPointer";
import { featuresToGeoJSON, planGeoJSONImport } from "~/hooks/map-editor/editor-geo-ops";
import type { EditorFeature } from "~/hooks/map-editor/editor-types";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { restorableBorderDraft, type BorderDraft } from "~/lib/maps/border-draft";
import { moveVertex } from "~/lib/maps/border-editor";
import { buildTopologyIndex } from "~/lib/maps/topology-engine";

type Shape = Polygon | MultiPolygon;

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
// A and B share the edge x=1; C is far away
const A = square(0, 0, 1, 1);
const B = square(1, 0, 2, 1);
const C = square(10, 10, 11, 11);

interface MutationMock {
  mutate: jest.Mock;
  mutateAsync: jest.Mock;
}
const { mutations } = jest.requireMock<{
  mutations: { startBorderEditSession: MutationMock; saveBorderEditDraft: MutationMock };
}>("~/trpc/react");
const startSession = mutations.startBorderEditSession;
const saveDraft = mutations.saveBorderEditDraft;

interface SessionData {
  feature: { geometry: Shape };
  neighbors: Array<{ featureId: string; displayName: string | null; geometry: Shape }>;
  draft?: BorderDraft | null;
}

/** The editor with feature A loaded from this session. */
function setup({ feature, neighbors, draft = null }: SessionData) {
  startSession.mutate.mockImplementation(
    (
      _input: { featureId: string },
      opts: { onSuccess: (data: SessionData & { session: { id: string } }) => void }
    ) => opts.onSuccess({ session: { id: "u_A" }, feature, neighbors, draft })
  );
  const hook = renderHook(() => useBorderEditor());
  act(() => hook.result.current[1].loadFeature("A"));
  return hook;
}

const NEIGHBORS = [{ featureId: "B", displayName: "B", geometry: B }];
const vertex = (ringIndex: number, vertexIndex: number, coord: Position) => ({
  ringIndex,
  vertexIndex,
  coord,
});
const DRAFT_KEYS = ["dirtyNeighbors", "featureId", "geometry", "savedAt"];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("a vertex drag", () => {
  it("carries exactly the neighbours sharing the vertex into the state, the saved draft and the undo history", async () => {
    const { result } = setup({
      feature: { geometry: A },
      neighbors: [...NEIGHBORS, { featureId: "C", displayName: "C", geometry: C }],
    });
    act(() => result.current[1].setMode("vertex_edit"));
    result.current[1].handleVertexDrag(vertex(0, 1, [1, 0]), [1.2, -0.1]);
    act(() => void result.current[1].commitDrag());

    const state = result.current[0];
    expect(state.geometry!.coordinates[0]![1]).toEqual([1.2, -0.1]);
    const movedB = state.neighborGeometries.B as Polygon;
    // Both copies of B's shared corner (its first and its closing vertex) move; its other corners stay
    expect(movedB.coordinates[0]![0]).toEqual([1.2, -0.1]);
    expect(movedB.coordinates[0]![4]).toEqual([1.2, -0.1]);
    expect(movedB.coordinates[0]![1]).toEqual(B.coordinates[0]![1]);
    expect(state.neighborGeometries.C).toEqual(C);
    expect(Object.keys(state.dirtyNeighbors)).toEqual(["B"]);

    await act(async () => {
      await result.current[1].save();
    });
    const sent = saveDraft.mutateAsync.mock.calls[0]![0].sessionData as BorderDraft;
    expect(Object.keys(sent).sort()).toEqual(DRAFT_KEYS);
    expect(Object.keys(sent.dirtyNeighbors)).toEqual(["B"]);

    act(() => result.current[1].undo());
    expect(result.current[0].geometry).toEqual(A);
    expect(result.current[0].neighborGeometries.B).toEqual(B);
    expect(result.current[0].dirtyNeighbors).toEqual({});
  });

  it("drops a drag whose feature was closed before the release", () => {
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS });
    act(() => result.current[1].setMode("vertex_edit"));
    result.current[1].handleVertexDrag(vertex(0, 0, [0, 0]), [-0.2, -0.2]);
    act(() => result.current[1].reset());
    act(() => void result.current[1].commitDrag());
    expect(result.current[0].geometry).toBeNull();
  });

  it("keeps the ring closed when its first vertex moves", () => {
    const moved = moveVertex(
      square(0, 0, 4, 4),
      { ringIndex: 0, vertexIndex: 0, coord: [0, 0] },
      [-1, -1]
    ) as Polygon;
    const ring = moved.coordinates[0]!;
    expect(ring[0]).toEqual([-1, -1]);
    expect(ring[ring.length - 1]).toEqual([-1, -1]);
  });

  describe("on a map", () => {
    afterEach(() => jest.restoreAllMocks());

    it("puts back the neighbours it carried along when Escape is pressed mid-drag", () => {
      // A map that records its event handlers so the test can fire them; everything else is a no-op
      const handlers = new Map<string, Array<(e: unknown) => void>>();
      const canvas = document.createElement("canvas");
      const map = new Proxy(
        {},
        {
          get: (_t, name: string) => {
            if (name === "on")
              return (type: string, layerOrFn: string | ((e: unknown) => void), fn?: object) => {
                const key = typeof layerOrFn === "string" ? `${type}:${layerOrFn}` : type;
                handlers.set(key, [
                  ...(handlers.get(key) ?? []),
                  (fn ?? layerOrFn) as (e: unknown) => void,
                ]);
              };
            if (name === "getCanvas") return () => canvas;
            if (name === "dragPan") return { enable: () => {}, disable: () => {} };
            if (name === "getSource" || name === "getLayer") return () => undefined;
            return jest.fn();
          },
        }
      ) as unknown as MapLibreMap;
      const fire = (key: string, e: unknown) => handlers.get(key)?.forEach((h) => h(e));
      // A requestAnimationFrame the test steps by hand
      const queue = new Map<number, FrameRequestCallback>();
      let nextFrame = 1;
      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        queue.set(nextFrame, cb);
        return nextFrame++;
      });
      jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => void queue.delete(id));
      const frame = () => {
        const callbacks = [...queue.values()];
        queue.clear();
        callbacks.forEach((cb) => cb(0));
      };

      const st = createVertexEditState();
      st.edit = { featureId: "region-1", currentGeometry: A };
      st.topology = buildTopologyIndex([
        { id: "region-1", geometry: A },
        { id: "region-2", geometry: B },
      ]);
      st.neighbors = new Map([["region-2", B]]);
      const topology = new Map(st.topology);
      const latest: { current: VertexEditLatest } = {
        current: { features: [], countryGeometry: null, snapEnabled: false },
      };
      renderHook(() =>
        useVertexEditPointer({
          map,
          isLoaded: true,
          stRef: { current: st },
          latest,
          updateVertexEditVis: () => {},
          scheduleThrottledUpdate: () => {},
          queueCascadeVisual: () => {},
        })
      );
      // Grab the shared vertex at [1, 1] and drag it far enough to commit
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
      fire("mousemove", { point: { x: 20, y: 0 }, lngLat: { lng: 2, lat: 2 }, originalEvent: {} });
      frame();
      expect((st.neighbors.get("region-2") as Polygon).coordinates[0]![3]).toEqual([2, 2]);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(st.neighbors.get("region-2")).toBe(B);
      expect(st.changedNeighborIds.size).toBe(0);
      expect(st.topology).toEqual(topology);
    });
  });
});

describe("an arrow-key nudge of a point", () => {
  afterEach(() => jest.useRealTimers());

  // Regression: the nudge moved the feature itself, so the undo step recorded the nudged place as where it was
  it("accumulates nudges without moving the feature itself, so the undo step records where it was", () => {
    jest.useFakeTimers();
    const city: EditorFeature = {
      id: "c1",
      type: "city",
      name: "Port",
      coordinates: [10, 20],
      properties: {},
    };
    const updatePointCoordinates = jest.fn().mockResolvedValue(undefined);
    const canvas = document.createElement("canvas");
    const map = new Proxy(
      {},
      {
        get: (_t, name: string) => {
          if (name === "getCanvas") return () => canvas;
          if (name === "getSource" || name === "getLayer") return () => undefined;
          return () => {};
        },
      }
    ) as unknown as MapLibreMap;
    renderHook(() =>
      usePointDrag({
        map,
        isLoaded: true,
        mode: "view",
        features: [city],
        selectedFeature: city,
        updatePointCoordinates,
      })
    );
    const press = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    const saved = () => updatePointCoordinates.mock.lastCall![2] as [number, number];

    press();
    press();
    expect(city.coordinates).toEqual([10, 20]);
    jest.advanceTimersByTime(400);
    expect(updatePointCoordinates).toHaveBeenCalledTimes(1);
    expect(saved()[0]).toBeCloseTo(10 + 2 * NUDGE_SMALL, 9);

    // A later burst carries on from where the last one left the point
    press();
    jest.advanceTimersByTime(400);
    expect(saved()[0]).toBeCloseTo(10 + 3 * NUDGE_SMALL, 9);
    expect(city.coordinates).toEqual([10, 20]);
  });
});

describe("the autosaved draft", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** A closed ring of `count` vertices with full-precision coordinates. */
  function bigPolygon(count: number): Polygon {
    const ring = Array.from({ length: count }, (_, i): Position => {
      const angle = (i / count) * 2 * Math.PI;
      return [100 + 10 * Math.cos(angle), 20 + 10 * Math.sin(angle)];
    });
    return { type: "Polygon", coordinates: [[...ring, [...ring[0]!]]] };
  }

  it("saves the four-field draft, under 1 MB, for a 7k-vertex polygon after 50 drags", () => {
    const big = bigPolygon(7000);
    const { result } = setup({ feature: { geometry: big }, neighbors: [] });
    act(() => result.current[1].setMode("vertex_edit"));

    for (let drag = 0; drag < 50; drag++) {
      const at = big.coordinates[0]![drag * 100]!;
      result.current[1].handleVertexDrag(vertex(0, drag * 100, at), [
        at[0]! + 0.0123456789,
        at[1]!,
      ]);
      act(() => void result.current[1].commitDrag());
    }
    expect(result.current[0].undoStackState.entries).toHaveLength(50);

    act(() => void jest.advanceTimersByTime(30_000));

    expect(saveDraft.mutate).toHaveBeenCalledTimes(1);
    const payload = saveDraft.mutate.mock.calls[0]![0] as {
      sessionId: string;
      sessionData: BorderDraft;
    };
    expect(payload.sessionId).toBe("u_A");
    expect(Object.keys(payload.sessionData).sort()).toEqual(DRAFT_KEYS);
    expect(payload.sessionData.featureId).toBe("A");
    expect(JSON.stringify(payload).length).toBeLessThan(1_000_000);
  });
});

describe("a saved draft", () => {
  const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
  const HOUR = 60 * 60 * 1000;
  const draft = (over: Partial<BorderDraft> = {}): BorderDraft => ({
    featureId: "A",
    geometry: square(0, 0, 1.3, 1),
    dirtyNeighbors: { B: square(1.3, 0, 2, 1) },
    savedAt: Date.UTC(2026, 9, 11),
    ...over,
  });

  it.each<[string, Partial<Parameters<typeof restorableBorderDraft>[0]>]>([
    [
      "once the border has been saved at the draft's time or after",
      { featureUpdatedAt: new Date(NOW - HOUR) },
    ],
    ["to another user", { sessionUserId: "user_2" }],
  ])("is not offered %s", (_name, over) => {
    const input = (change: typeof over = {}) => ({
      sessionData: { ...draft({ featureId: "Caphiria" }), savedAt: NOW - HOUR },
      sessionUserId: "user_1",
      sessionFeatureId: "Caphiria",
      userId: "user_1",
      featureId: "Caphiria",
      featureUpdatedAt: new Date(NOW - 2 * HOUR),
      now: NOW,
      ...change,
    });
    // The same draft is offered to its own user while it is newer than the border
    expect(restorableBorderDraft(input())).not.toBeNull();
    expect(restorableBorderDraft(input(over))).toBeNull();
  });

  it("is restored as unsaved changes that move only real neighbours, and revert brings the saved border back", () => {
    const offered = draft({ dirtyNeighbors: { B: square(1.3, 0, 2, 1), Z: square(5, 5, 6, 6) } });
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: offered });

    act(() => result.current[1].restoreDraft(offered));
    const state = result.current[0];
    expect(state.pendingDraft).toBeNull();
    expect(state.geometry).toBe(offered.geometry);
    expect(state.neighborGeometries.B).toBe(offered.dirtyNeighbors.B);
    expect(state.originalNeighborGeometries.B).toBe(B);
    // Z is no neighbour of A: the draft does not reach it
    expect(state.neighborGeometries.Z).toBeUndefined();
    expect(Object.keys(state.dirtyNeighbors)).toEqual(["B"]);
    expect(state.isDirty).toBe(true);
    expect(state.undoStackState.entries).toHaveLength(0);

    act(() => result.current[1].revert());
    expect(result.current[0].geometry).toBe(A);
    expect(result.current[0].neighborGeometries.B).toBe(B);
    expect(result.current[0].isDirty).toBe(false);
  });

  it("is reset on discard, so it is not offered again", () => {
    const offered = draft();
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: offered });
    act(() => result.current[1].discardDraft(offered));
    expect(saveDraft.mutate).toHaveBeenCalledTimes(1);
    expect(saveDraft.mutate).toHaveBeenCalledWith({
      sessionId: "u_A",
      sessionData: { undoStack: [], mode: "select" },
    });
  });

  it("is not restored once it is no longer the one on offer", () => {
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: draft() });
    act(() => result.current[1].restoreDraft(draft()));
    expect(result.current[0].geometry).toBe(A);
    expect(result.current[0].pendingDraft).not.toBeNull();
  });

  it("is asked about once however often the editor renders, and restored when accepted", async () => {
    jest.mocked(confirmEditorAction).mockResolvedValue(true);
    const offered = draft();
    const actions = { restoreDraft: jest.fn(), discardDraft: jest.fn() };
    type Props = Parameters<typeof useBorderDraftPrompt>[0];
    const { rerender } = renderHook(
      ({ state }: { state: Props }) => useBorderDraftPrompt(state, actions),
      { initialProps: { state: { featureId: "A", pendingDraft: offered } } }
    );
    rerender({ state: { featureId: "A", pendingDraft: offered } });
    rerender({ state: { featureId: "A", pendingDraft: offered } });
    // Let the confirm promise's continuation run
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(confirmEditorAction).toHaveBeenCalledTimes(1);
    expect(actions.restoreDraft).toHaveBeenCalledWith(offered);
    expect(actions.discardDraft).not.toHaveBeenCalled();
  });
});

describe("GeoJSON export and import", () => {
  it("imports an export again, and skips what is neither a point nor an area", () => {
    const exported = featuresToGeoJSON([
      { id: "c1", type: "city", name: "City c1", coordinates: [1, 2], properties: {} },
      { id: "r1", type: "subdivision", name: "Region r1", geometry: A, properties: {} },
    ]);
    const plan = planGeoJSONImport({
      ...exported,
      features: [
        ...exported.features,
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          properties: {},
        },
        { type: "Feature", geometry: null, properties: {} },
      ],
    });
    expect(plan.features.map((f) => [f.kind, f.name])).toEqual([
      ["city", "City c1"],
      ["subdivision", "Region r1"],
    ]);
    expect(plan.skipped).toBe(2);
  });
});
