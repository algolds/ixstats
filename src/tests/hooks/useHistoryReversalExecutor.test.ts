/**
 * The history executor must send *partial* updates (an undone move never renames
 * a city or clears its capital flag), route story pins / labels to their own
 * procedures, resolve ids of re-created features, and undo batches in reverse.
 */

import { renderHook, act } from "@testing-library/react";

const calls: Array<{ proc: string; input: Record<string, unknown> }> = [];
let idCounter = 0;
const mutations = new Map<string, { mutateAsync: jest.Mock }>();

function mutationFor(proc: string) {
  let m = mutations.get(proc);
  if (!m) {
    m = {
      mutateAsync: jest.fn(async (input: Record<string, unknown>) => {
        calls.push({ proc, input });
        return { id: `new-${++idCounter}` };
      }),
    };
    mutations.set(proc, m);
  }
  return m;
}

jest.mock("~/trpc/react", () => {
  const router = (name: string) =>
    new Proxy(
      {},
      { get: (_t, proc: string) => ({ useMutation: () => mutationFor(`${name}.${proc}`) }) }
    );
  return {
    api: {
      geoFeatures: router("geoFeatures"),
      countryGeo: router("countryGeo"),
      transport: router("transport"),
    },
  };
});

import { useHistoryReversalExecutor } from "~/hooks/map-editor/useHistoryReversalExecutor";
import type { EditorAction } from "~/hooks/map-editor/useMapHistory";

function setup() {
  return renderHook(() =>
    useHistoryReversalExecutor({
      countryId: "country-1",
      invalidateAllMapData: () => undefined,
      debouncedRefetch: () => undefined,
    })
  ).result;
}

beforeEach(() => {
  calls.length = 0;
  idCounter = 0;
});

describe("useHistoryReversalExecutor", () => {
  it("undoes a city move with a coordinates-only patch", async () => {
    const result = setup();
    const action: EditorAction = {
      type: "update",
      featureType: "city",
      featureId: "city-1",
      description: "Moved city",
      timestamp: 0,
      previousData: { coordinates: [1, 2] },
      newData: { coordinates: [3, 4] },
    };
    await act(() => result.current.applyInverseAction(action));
    expect(calls).toEqual([
      {
        proc: "geoFeatures.updateCity",
        input: { countryId: "country-1", cityId: "city-1", coordinates: [1, 2] },
      },
    ]);
  });

  it("uses the story-pin and map-label procedures, not the POI ones", async () => {
    const result = setup();
    await act(() => result.current.deleteFeatureById("storyPin", "pin-1"));
    await act(() => result.current.deleteFeatureById("mapLabel", "label-1"));
    expect(calls.map((c) => c.proc)).toEqual([
      "geoFeatures.deleteStoryPin",
      "geoFeatures.deleteMapLabel",
    ]);
  });

  it("follows the new id after a delete is undone", async () => {
    const result = setup();
    const del: EditorAction = {
      type: "delete",
      featureType: "poi",
      featureId: "poi-old",
      description: "Deleted POI",
      timestamp: 0,
      previousData: { name: "Tower", category: "military", coordinates: [5, 6], population: null },
    };
    await act(() => result.current.applyInverseAction(del)); // re-creates → new-1
    await act(() => result.current.applyForwardAction(del)); // deletes again
    expect(calls[0]!.proc).toBe("geoFeatures.createPOI");
    expect(calls[1]).toEqual({
      proc: "geoFeatures.deletePOI",
      input: { countryId: "country-1", poiId: "new-1" },
    });
  });

  it("undoes a batch in reverse order", async () => {
    const result = setup();
    const batch: EditorAction = {
      type: "batch",
      featureType: "city",
      featureId: "a",
      description: "Merged cities",
      timestamp: 0,
      subActions: [
        {
          type: "update",
          featureType: "city",
          featureId: "a",
          description: "",
          timestamp: 0,
          previousData: { population: 10 },
          newData: { population: 30 },
        },
        {
          type: "delete",
          featureType: "city",
          featureId: "b",
          description: "",
          timestamp: 0,
          previousData: { name: "B", coordinates: [0, 0], population: 20 },
        },
      ],
    };
    await act(() => result.current.applyInverseAction(batch));
    expect(calls.map((c) => c.proc)).toEqual(["geoFeatures.createCity", "geoFeatures.updateCity"]);
    expect(calls[1]!.input).toEqual({ countryId: "country-1", cityId: "a", population: 10 });
  });

  it("writes region colour through the attribute upsert with type and level", async () => {
    const result = setup();
    await act(() =>
      result.current.restoreFeatureData("subdivision", "sub-1", {
        type: "province",
        level: 2,
        color: "#112233",
      })
    );
    expect(calls).toEqual([
      {
        proc: "countryGeo.upsertSubdivision",
        input: {
          countryId: "country-1",
          id: "sub-1",
          type: "province",
          level: 2,
          color: "#112233",
        },
      },
    ]);
  });

  it("sends cascaded neighbour geometries with a region reshape", async () => {
    const result = setup();
    const g1 = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const g2 = {
      type: "Polygon",
      coordinates: [
        [
          [1, 0],
          [2, 0],
          [2, 1],
          [1, 0],
        ],
      ],
    };
    await act(() =>
      result.current.applyForwardAction({
        type: "update",
        featureType: "subdivision",
        featureId: "sub-1",
        description: "",
        timestamp: 0,
        previousData: { geometry: g1 },
        newData: { geometry: g1 },
        cascadedUpdates: [
          {
            featureId: "sub-2",
            featureType: "subdivision",
            previousData: { geometry: g1 },
            newData: { geometry: g2 },
          },
        ],
      })
    );
    expect(calls[0]!.input).toEqual({
      countryId: "country-1",
      subdivisionId: "sub-1",
      geometry: g1,
      cascadedNeighbors: [{ subdivisionId: "sub-2", geometry: g2 }],
    });
  });
});
