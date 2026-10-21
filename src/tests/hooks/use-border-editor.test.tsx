import { type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
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
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { cascadeMoveVertex, vkey } from "~/lib/maps/topology-engine";
import type { BorderDraft } from "~/lib/maps/border-draft";

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
// A and B share the edge x=1
const A = square(0, 0, 1, 1);
const B = square(1, 0, 2, 1);

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

/** Makes the next `loadFeature` succeed with this session. */
function serve({ feature, neighbors, draft = null }: SessionData) {
  startSession.mutate.mockImplementation(
    (
      _input: { featureId: string },
      opts: { onSuccess: (data: SessionData & { session: { id: string } }) => void }
    ) => opts.onSuccess({ session: { id: "u_A" }, feature, neighbors, draft })
  );
}

function setup(session: SessionData, wrapper?: (props: { children: ReactNode }) => ReactNode) {
  serve(session);
  let renders = 0;
  const hook = renderHook(
    () => {
      renders++;
      return useBorderEditor();
    },
    { wrapper }
  );
  act(() => hook.result.current[1].loadFeature("A"));
  return { ...hook, renders: () => renders };
}

const NEIGHBORS = [{ featureId: "B", displayName: "B", geometry: B }];
const vertex = (ringIndex: number, vertexIndex: number, coord: Position) => ({
  ringIndex,
  vertexIndex,
  coord,
});

beforeEach(() => {
  jest.clearAllMocks();
});
describe("useBorderEditor vertex drag", () => {
  function dragSetup() {
    const setupResult = setup({ feature: { geometry: A }, neighbors: NEIGHBORS });
    act(() => setupResult.result.current[1].setMode("vertex_edit"));
    return setupResult;
  }

  it("carries the neighbour sharing the vertex into state and undo history on release", () => {
    const { result } = dragSetup();
    const actions = result.current[1];

    actions.handleVertexDrag(vertex(0, 1, [1, 0]), [1.2, -0.1]);
    act(() => void actions.commitDrag());

    const state = result.current[0];
    expect(state.neighborGeometries.B!.coordinates[0]![0]).toEqual([1.2, -0.1]);
    expect(Object.keys(state.dirtyNeighbors)).toEqual(["B"]);
    expect(state.selectedVertex).toMatchObject({
      ringIndex: 0,
      vertexIndex: 1,
      coord: [1.2, -0.1],
    });

    act(() => actions.undo());
    expect(result.current[0].geometry).toEqual(A);
    expect(result.current[0].neighborGeometries.B).toEqual(B);
    expect(result.current[0].dirtyNeighbors).toEqual({});
  });
  it("drops a drag whose feature was closed before the release", () => {
    const { result } = dragSetup();
    const actions = result.current[1];
    actions.handleVertexDrag(vertex(0, 0, [0, 0]), [-0.2, -0.2]);

    act(() => actions.reset());
    act(() => void actions.commitDrag());

    expect(result.current[0].geometry).toBeNull();
  });
});
describe("useBorderEditor autosave", () => {
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
    expect(Object.keys(payload.sessionData).sort()).toEqual([
      "dirtyNeighbors",
      "featureId",
      "geometry",
      "savedAt",
    ]);
    expect(payload.sessionData.featureId).toBe("A");
    expect(JSON.stringify(payload).length).toBeLessThan(1_000_000);
  });

  it("includes the neighbours a drag moved, and saves on demand in the same shape", async () => {
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS });
    act(() => result.current[1].setMode("vertex_edit"));
    result.current[1].handleVertexDrag(vertex(0, 1, [1, 0]), [1.2, -0.1]);
    act(() => void result.current[1].commitDrag());

    await act(async () => {
      await result.current[1].save();
    });

    const sent = saveDraft.mutateAsync.mock.calls[0]![0].sessionData;
    expect(Object.keys(sent).sort()).toEqual([
      "dirtyNeighbors",
      "featureId",
      "geometry",
      "savedAt",
    ]);
    expect(Object.keys(sent.dirtyNeighbors)).toEqual(["B"]);
  });

  it("does not save before an edit, or while the timer keeps being restarted", () => {
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS });
    act(() => void jest.advanceTimersByTime(60_000));
    expect(saveDraft.mutate).not.toHaveBeenCalled();

    act(() => result.current[1].setMode("vertex_edit"));
    result.current[1].handleVertexDrag(vertex(0, 0, [0, 0]), [-0.1, -0.1]);
    act(() => void result.current[1].commitDrag());
    act(() => void jest.advanceTimersByTime(20_000));
    result.current[1].handleVertexDrag(vertex(0, 3, [0, 1]), [-0.1, 1.1]);
    act(() => void result.current[1].commitDrag());
    act(() => void jest.advanceTimersByTime(20_000));
    expect(saveDraft.mutate).not.toHaveBeenCalled();

    act(() => void jest.advanceTimersByTime(10_000));
    expect(saveDraft.mutate).toHaveBeenCalledTimes(1);
  });
});

describe("useBorderEditor draft restore", () => {
  const draft = (over: Partial<BorderDraft> = {}): BorderDraft => ({
    featureId: "A",
    geometry: square(0, 0, 1.3, 1),
    dirtyNeighbors: { B: square(1.3, 0, 2, 1) },
    savedAt: Date.UTC(2026, 9, 11),
    ...over,
  });
  it("restores the outline and the moved neighbours as unsaved changes", () => {
    const offered = draft();
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: offered });

    act(() => result.current[1].restoreDraft(offered));

    const state = result.current[0];
    expect(state.pendingDraft).toBeNull();
    expect(state.geometry).toBe(offered.geometry);
    expect(state.neighborGeometries.B).toBe(offered.dirtyNeighbors.B);
    expect(state.dirtyNeighbors.B).toBe(offered.dirtyNeighbors.B);
    expect(state.originalNeighborGeometries.B).toBe(B);
    expect(state.isDirty).toBe(true);
    expect(state.areaKm2).toBeGreaterThan(0);
    expect(state.undoStackState.entries).toHaveLength(0);
  });

  it("reverts a restored draft to the saved border", () => {
    const offered = draft();
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: offered });
    act(() => result.current[1].restoreDraft(offered));

    act(() => result.current[1].revert());

    expect(result.current[0].geometry).toBe(A);
    expect(result.current[0].neighborGeometries.B).toBe(B);
    expect(result.current[0].isDirty).toBe(false);
  });

  it("ignores moved neighbours that are not neighbours of this feature", () => {
    const offered = draft({ dirtyNeighbors: { Z: square(5, 5, 6, 6) } });
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: offered });

    act(() => result.current[1].restoreDraft(offered));

    expect(result.current[0].neighborGeometries.Z).toBeUndefined();
    expect(result.current[0].dirtyNeighbors).toEqual({});
  });
  it("resets the saved draft on discard, so it is not offered again", () => {
    const offered = draft();
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS, draft: offered });

    act(() => result.current[1].discardDraft(offered));

    expect(saveDraft.mutate).toHaveBeenCalledTimes(1);
    expect(saveDraft.mutate).toHaveBeenCalledWith({
      sessionId: "u_A",
      sessionData: { undoStack: [], mode: "select" },
    });
  });
  it("does not restore a draft that is no longer the one on offer", () => {
    const { result } = setup({
      feature: { geometry: A },
      neighbors: NEIGHBORS,
      draft: draft(),
    });

    act(() => result.current[1].restoreDraft(draft()));

    expect(result.current[0].geometry).toBe(A);
    expect(result.current[0].pendingDraft).not.toBeNull();
  });
});

describe("a shared vertex moved by cascadeMoveVertex still agrees with the drag", () => {
  it("lands on the same outlines as the topology engine", () => {
    const { result } = setup({ feature: { geometry: A }, neighbors: NEIGHBORS });
    act(() => result.current[1].setMode("vertex_edit"));
    result.current[1].handleVertexDrag(vertex(0, 1, [1, 0]), [1.2, -0.1]);
    act(() => void result.current[1].commitDrag());

    const key = vkey([1.2, -0.1]);
    const refs = [
      { featureId: "A", ringIndex: 0, vertexIndex: 1 },
      { featureId: "B", ringIndex: 0, vertexIndex: 0 },
      { featureId: "B", ringIndex: 0, vertexIndex: 4 },
    ];
    const expected = cascadeMoveVertex(
      new Map([[key, refs]]),
      new Map<string, Shape>([
        ["A", A],
        ["B", B],
      ]),
      key,
      [1.2, -0.1]
    );
    expect(result.current[0].geometry).toEqual(expected.get("A"));
    expect(result.current[0].neighborGeometries.B).toEqual(expected.get("B"));
  });
});
