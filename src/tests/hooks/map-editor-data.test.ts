/**
 * The map editor never loses or clobbers what a cartographer did: a refetch of the selected feature keeps its unsaved
 * edits (another feature reloads), an undo sends only what it changes (a moved city keeps its name and capital
 * flag), follows a feature that the undo re-created to its new id, undoes a batch in reverse, carries the neighbours
 * a reshape moved, and a new edit after an undo drops the redo branch. A duplicate is never a second capital or a
 * second claim on the original's wiki page.
 *
 * Folds useEditorFeatureProperties, useHistoryReversalExecutor, useMapHistory and duplicateFeature.
 */
import { act, renderHook } from "@testing-library/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";

const calls: Array<{ proc: string; input: Record<string, unknown> }> = [];
let idCounter = 0;
const mockMutations = new Map<string, { mutateAsync: jest.Mock }>();
let mockDetails: { wikiPageTitle: string | null; properties: Record<string, unknown> } | undefined;

function mockMutationFor(proc: string) {
  let m = mockMutations.get(proc);
  if (!m) {
    m = {
      mutateAsync: jest.fn(async (input: Record<string, unknown>) => {
        calls.push({ proc, input });
        return { id: `new-${++idCounter}` };
      }),
    };
    mockMutations.set(proc, m);
  }
  return m;
}

jest.mock("~/trpc/react", () => {
  const router = (name: string) =>
    new Proxy(
      {},
      { get: (_t, proc: string) => ({ useMutation: () => mockMutationFor(`${name}.${proc}`) }) }
    );
  const mutation = { useMutation: () => ({ mutate: jest.fn(), isPending: false }) };
  return {
    api: {
      useUtils: () => ({}),
      geoFeatures: router("geoFeatures"),
      countryGeo: router("countryGeo"),
      transport: router("transport"),
      geoEditor: {
        getFeatureDetails: { useQuery: () => ({ data: mockDetails, refetch: jest.fn() }) },
        updateFeatureProperties: mutation,
        createCountryFromShape: mutation,
      },
      geoCore: { recalculateArea: mutation },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({ notifyFromStore: jest.fn() }));

import { useEditorFeatureProperties } from "~/components/maps/editor/hooks/state/useEditorFeatureProperties";
import { useHistoryReversalExecutor } from "~/hooks/map-editor/useHistoryReversalExecutor";
import { useMapHistory, type EditorAction } from "~/hooks/map-editor/useMapHistory";
import { buildDuplicateInput } from "~/hooks/useMapEditor";

const executor = () =>
  renderHook(() =>
    useHistoryReversalExecutor({
      countryId: "country-1",
      invalidateAllMapData: () => undefined,
      debouncedRefetch: () => undefined,
    })
  ).result;

beforeEach(() => {
  calls.length = 0;
  idCounter = 0;
});

it("keeps unsaved property edits through a refetch of the same feature, and reloads for another", () => {
  const selected = (featureId: string) =>
    ({ featureId, displayName: featureId }) as SelectedCountry;
  mockDetails = { wikiPageTitle: "A", properties: {} };
  const { result, rerender } = renderHook(
    ({ sel }: { sel: SelectedCountry }) =>
      useEditorFeatureProperties({
        mapSelectedCountry: sel,
        realm: undefined as never,
        refetchValidation: () => undefined,
      }),
    { initialProps: { sel: selected("f1") } }
  );
  act(() => result.current.setWikiPageTitle("Edited"));
  mockDetails = { wikiPageTitle: "A", properties: {} }; // a fresh object, as a window-focus refetch returns
  rerender({ sel: selected("f1") });
  expect(result.current.wikiPageTitle).toBe("Edited");

  mockDetails = { wikiPageTitle: "Other", properties: {} };
  rerender({ sel: selected("f2") });
  expect(result.current.wikiPageTitle).toBe("Other");
});

it("undoes a city move with its coordinates only, never its name or capital flag", async () => {
  const result = executor();
  await act(() =>
    result.current.applyInverseAction({
      type: "update",
      featureType: "city",
      featureId: "city-1",
      description: "Moved city",
      timestamp: 0,
      previousData: { coordinates: [1, 2] },
      newData: { coordinates: [3, 4] },
    })
  );
  expect(calls).toEqual([
    {
      proc: "geoFeatures.updateCity",
      input: { countryId: "country-1", cityId: "city-1", coordinates: [1, 2] },
    },
  ]);
});

it("follows a feature that an undo re-created to its new id", async () => {
  const result = executor();
  const deleted: EditorAction = {
    type: "delete",
    featureType: "poi",
    featureId: "poi-old",
    description: "Deleted POI",
    timestamp: 0,
    previousData: { name: "Tower", category: "military", coordinates: [5, 6], population: null },
  };
  await act(() => result.current.applyInverseAction(deleted));
  await act(() => result.current.applyForwardAction(deleted));
  expect(calls.map((c) => c.proc)).toEqual(["geoFeatures.createPOI", "geoFeatures.deletePOI"]);
  expect(calls[1]!.input).toEqual({ countryId: "country-1", poiId: "new-1" });
});

it("undoes a batch in reverse, each step with its own patch", async () => {
  const result = executor();
  await act(() =>
    result.current.applyInverseAction({
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
    })
  );
  expect(calls.map((c) => c.proc)).toEqual(["geoFeatures.createCity", "geoFeatures.updateCity"]);
  expect(calls[1]!.input).toEqual({ countryId: "country-1", cityId: "a", population: 10 });
});

it("sends the neighbours a region reshape moved with it", async () => {
  const result = executor();
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

it("drops the redo branch when a new edit follows an undo", () => {
  const { result } = renderHook(() => useMapHistory());
  const action = (description: string): Omit<EditorAction, "timestamp"> => ({
    type: "update",
    featureType: "city",
    featureId: "city-1",
    description,
    previousData: {},
    newData: {},
  });
  act(() => {
    result.current.pushAction(action("Created"));
    result.current.pushAction(action("Renamed"));
  });
  act(() => {
    result.current.undo();
  });
  act(() => result.current.pushAction(action("Deleted")));
  expect(result.current.actions.map((a) => a.description)).toEqual(["Created", "Deleted"]);
  expect(result.current.canRedo).toBe(false);
});

it("makes a duplicate of a capital city no capital and no second claim on its wiki page", () => {
  const copy = buildDuplicateInput({
    id: "city-1",
    type: "city",
    name: "Riverdale",
    coordinates: [10, 20],
    properties: {
      cityType: "city",
      population: 50000,
      isNationalCapital: true,
      isSubdivisionCapital: true,
      wikiPageTitle: "Riverdale",
    },
  }) as Record<string, unknown>;
  expect(copy).toMatchObject({
    name: "Riverdale (copy)",
    population: 50000,
    isNationalCapital: false,
    isSubdivisionCapital: false,
    wikiPageTitle: undefined,
  });
  expect(copy.coordinates).not.toEqual([10, 20]);
});
