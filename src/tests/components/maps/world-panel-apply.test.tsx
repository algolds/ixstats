/**
 * The World tab and its apply region: what the region is given of the draft and the lock, a world applied while the
 * tab was away.
 */
import { act, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const { createMockQuery } = jest.requireActual("../../../../jest-mocks/trpc-react");
  const fake = jest.requireActual("~/tests/helpers/fake-map-import");
  return {
    api: {
      useUtils: fake.useUtils,
      geoEditor: fake.geoEditor,
      realms: {
        map: {
          display: { useQuery: jest.fn(() => createMockQuery()) },
          worldStatus: { useQuery: jest.fn(() => createMockQuery()) },
          worldPresets: { useQuery: jest.fn(() => createMockQuery()) },
        },
      },
    },
  };
});
jest.mock("~/hooks/useWorldPreview", () => ({ useWorldPreview: jest.fn() }));
jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: jest.fn(),
  useRetryMapLayers: jest.fn(),
}));
// The real region, called through, so its props can be read
jest.mock("~/components/maps/editor/panels/WorldApplyRegion", () => {
  const actual = jest.requireActual("~/components/maps/editor/panels/WorldApplyRegion");
  return { ...actual, WorldApplyRegion: jest.fn(actual.WorldApplyRegion) };
});
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import {
  loadWorldJob,
  loadWorldRecipe,
  saveWorldJob,
  saveWorldRecipe,
} from "~/lib/worldgen/world-draft-recipe";
import { draftKey } from "~/lib/worldgen/world-apply";
import { resultMessage, worldResult } from "~/tests/helpers/fake-world-worker";
import { setJob } from "~/tests/helpers/fake-map-import";
import {
  statusQuery,
  layersQuery,
  REALM,
  mapLayers,
  workers,
  renderPanel,
  lastRequest,
  requestCount,
  generateFirst,
  resetPanelTests,
  cleanUpPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);
describe("a world applied while the tab was away", () => {
  // The world the recipe makes again: seed 31 with the generator's defaults
  const PARAMS = { ...DEFAULT_PARAMS, seed: 31 };
  const JOB = {
    checkJobId: "j_check",
    applyJobId: "j_apply",
    draftKey: draftKey(worldResult({ seed: 31, params: PARAMS }), "preset"),
  };
  const APPLIED = {
    status: "succeeded",
    progress: 100,
    stage: null,
    error: null,
    result: {
      phase: "world-apply",
      written: 4,
      rejected: [],
      deactivated: 0,
      slots: { created: 2, retired: 0, opened: 2 },
      mapImportId: "i_1",
      rollbackAvailable: true,
      relief: { status: "built", version: "v1", tiles: 1, error: null },
    },
  };
  const savedRecipe = () =>
    saveWorldRecipe(REALM, { seed: 31, controls: controlsForPreset("ixnay") });

  it("does not bring the old draft back over the world that was applied, and forgets its recipe", () => {
    savedRecipe();
    saveWorldJob(REALM, JOB);
    setJob("j_apply", APPLIED);
    renderPanel();
    expect(screen.getByText("The world is applied")).toBeInTheDocument();
    expect(requestCount()).toBe(0);
    expect(loadWorldRecipe(REALM)).toBeNull();
    expect(loadWorldJob(REALM)).toBeNull();
    expect(screen.getByRole("button", { name: "Generate preview" })).toBeInTheDocument();
  });
  it("keeps the draft when the apply that was running failed", () => {
    savedRecipe();
    saveWorldJob(REALM, JOB);
    setJob("j_apply", { status: "failed", progress: 40, stage: null, error: "Interrupted" });
    renderPanel();
    expect(screen.getByText("The world could not be applied.")).toBeInTheDocument();
    expect(requestCount()).toBe(1);
    expect(loadWorldRecipe(REALM)).not.toBeNull();
  });
  describe("a review left while the realm's map was edited", () => {
    const FIT_PARAMS = { ...DEFAULT_PARAMS, seed: 31 };
    const fittedRecipe = () =>
      saveWorldRecipe(REALM, {
        seed: 31,
        controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
      });
    /** The check the tab left on the review, of the map at version 5, for the world the recipe makes */
    const leaveReviewOfMapAt = (version: number) => {
      fittedRecipe();
      saveWorldJob(REALM, {
        checkJobId: "j_check",
        applyJobId: null,
        draftKey: draftKey(worldResult({ seed: 31, params: FIT_PARAMS }), "realm-map"),
      });
      setJob("j_check", {
        status: "succeeded",
        progress: 100,
        stage: null,
        error: null,
        result: {
          phase: "world-dry-run",
          mapVersion: version,
          source: "realm-map",
          seed: 31,
          developmentLevel: "industrial",
          layers: Object.fromEntries(
            ["background", "altitudes", "climate", "political", "rivers", "lakes", "icecaps"].map(
              (layer) => [layer, { create: 0, change: 0, retire: 0 }]
            )
          ),
          slots: { create: 0, retire: 0, keep: 0, reserved: 0, renamed: 0 },
          warnings: [],
          replaces: [],
        },
      });
    };
    const restoreDraft = () =>
      act(() =>
        workers.at(-1)!.say(resultMessage(lastRequest().id, { seed: 31, params: FIT_PARAMS }))
      );

    it("will not apply the old check to the world fitted to the edited map", () => {
      leaveReviewOfMapAt(5);
      layersQuery.mockReturnValue(mapLayers({ version: 6 }));
      renderPanel();
      restoreDraft();
      expect(screen.getByText(/The realm's map changed after this check/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
      expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
    });
  });
});

describe("the apply region", () => {
  const useWorld = () => screen.getByRole("button", { name: "Use this world" });
  it("keeps it off while claims lock the realm, though a preview can be made", async () => {
    statusQuery.mockReturnValue({
      data: { lockReason: "claims", pendingClaims: 1, approvedClaims: 0, canReviewClaims: true },
    });
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say(resultMessage(request.id)));
    expect(useWorld()).toBeDisabled();
    expect(screen.getByText("Claims on this realm's nations lock its world.")).toBeInTheDocument();
  });
});
