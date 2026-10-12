/**
 * The World tab and its apply region: what the region is given of the draft and the lock, a world applied while the
 * tab was away, and the studio's sandbox, which has a calibration readout and no apply region.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";

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

import { WorldPanel } from "~/components/maps/editor/panels/WorldPanel";
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
import { failRead, setJob } from "~/tests/helpers/fake-map-import";
import {
  statusQuery,
  preview,
  layersQuery,
  region,
  REALM,
  mapLayers,
  workers,
  factory,
  renderPanel,
  lastRequest,
  requestCount,
  generateFirst,
  step,
  resetPanelTests,
  cleanUpPanelTests,
} from "~/tests/helpers/world-panel-fixtures";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);
beforeEach(resetPanelTests);
afterEach(cleanUpPanelTests);

describe("what the apply region is given of the draft", () => {
  const props = () => region.mock.lastCall![0];

  it("hands over the realm, the draft and how it was made", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say(resultMessage(request.id, { seed: request.seed })));
    expect(props()).toMatchObject({
      realm: { id: REALM, slug: "eurth" },
      source: "preset",
      generating: false,
      result: expect.objectContaining({ seed: request.seed }),
    });
  });

  it("calls a draft that matches the controls and the seed current, and one mid-drag stale", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say(resultMessage(request.id)));
    expect(props().stale).toBe(false);
    // A key held on the slider: the readout moves, no world is asked for yet
    const thumb = screen.getByRole("slider", { name: "Continents" });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(props().stale).toBe(true);
    fireEvent.keyUp(thumb, { key: "ArrowRight" });
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    expect(props().stale).toBe(false);
  });

  it("calls the draft stale when the latest generation failed", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say(resultMessage(request.id)));
    step("Continents");
    act(() => workers.at(-1)!.say({ type: "error", id: lastRequest().id, message: "failed" }));
    expect(props().stale).toBe(true);
  });

  it("calls a draft fitted to the realm's map stale while that map loads, and again fresh once refitted", () => {
    const { rerender } = renderPanel();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Source" })).getByRole("radio", {
        name: "This realm's map",
      })
    );
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    expect(props().stale).toBe(false);

    layersQuery.mockReturnValue(mapLayers({ political: 4, pending: true }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(props().stale).toBe(true);

    layersQuery.mockReturnValue(mapLayers({ political: 4 }));
    rerender(<WorldPanel map={null} createWorker={factory} />);
    expect(props().generating).toBe(true);
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    expect(props().stale).toBe(false);
    expect(props().generating).toBe(false);
  });
});

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

  it("brings the draft back, then takes it away when the apply that was running lands", () => {
    savedRecipe();
    saveWorldJob(REALM, JOB);
    setJob("j_apply", { status: "running", progress: 40, stage: "Writing the map", error: null });
    renderPanel();
    expect(requestCount()).toBe(1);
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id, { seed: 31, params: PARAMS })));
    act(() => setJob("j_apply", APPLIED));
    expect(screen.getByText("The world is applied")).toBeInTheDocument();
    expect(loadWorldRecipe(REALM)).toBeNull();
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

  it("brings the draft back when the job is gone", () => {
    savedRecipe();
    saveWorldJob(REALM, JOB);
    failRead("j_apply", { message: "Import not found", data: { code: "NOT_FOUND" } });
    renderPanel();
    expect(screen.getByRole("button", { name: "Use this world" })).toBeInTheDocument();
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

    it("applies it when the map is as the check read it", () => {
      leaveReviewOfMapAt(5);
      layersQuery.mockReturnValue(mapLayers({ version: 5 }));
      renderPanel();
      restoreDraft();
      expect(screen.getByRole("button", { name: "Apply this world" })).toBeEnabled();
    });
  });

  it("still lets a new preview be made after the world was applied", () => {
    savedRecipe();
    saveWorldJob(REALM, JOB);
    setJob("j_apply", APPLIED);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(requestCount()).toBe(1);
    expect(loadWorldRecipe(REALM)).not.toBeNull();
  });
});

describe("the apply region and the sandbox", () => {
  const useWorld = () => screen.getByRole("button", { name: "Use this world" });

  it("offers Use this world once there is a current preview and the realm is open", async () => {
    renderPanel();
    expect(useWorld()).toBeDisabled();
    expect(screen.getByText("Make a preview first.")).toBeInTheDocument();
    const request = await generateFirst();
    expect(useWorld()).toBeDisabled();
    expect(screen.getByText("Wait for the preview to finish.")).toBeInTheDocument();
    act(() => workers[0]!.say(resultMessage(request.id)));
    expect(useWorld()).toBeEnabled();
  });

  it("turns it off while a slider is mid-drag, and again once the new preview is made", async () => {
    renderPanel();
    const request = await generateFirst();
    act(() => workers[0]!.say(resultMessage(request.id)));
    const thumb = screen.getByRole("slider", { name: "Continents" });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(useWorld()).toBeDisabled();
    fireEvent.keyUp(thumb, { key: "ArrowRight" });
    act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
    expect(useWorld()).toBeEnabled();
  });

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

  it("has no apply region in the sandbox, and does not ask about claims", async () => {
    renderPanel({ sandbox: true });
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();
    expect(statusQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    expect(
      screen.getByText("Generate a preview to compare it with Ixnay and Eurth.")
    ).toBeInTheDocument();
  });

  it("shows the calibration against Ixnay and Eurth once the sandbox has a world", async () => {
    renderPanel({ sandbox: true });
    const request = await generateFirst();
    act(() =>
      workers[0]!.say(
        resultMessage(request.id, {
          stats: {
            landShare: 0.25,
            continents: 5,
            climateMix: { A: 0.4 },
            slotCount: 0,
            baseline: null,
          },
          cells: new Float32Array([0, 0, 10, 1, 0, 200]).buffer,
        })
      )
    );
    const table = screen.getByLabelText("Calibration against Ixnay and Eurth");
    expect(within(table).getByRole("columnheader", { name: "Ixnay" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Eurth" })).toBeInTheDocument();
    expect(within(table).getByText("Land share")).toBeInTheDocument();
    expect(within(table).getByText("Coastal Lowlands")).toBeInTheDocument();
    expect(within(table).getByText("Tropical")).toBeInTheDocument();
    expect(within(table).getAllByText("22.9%").length).toBe(2);
  });

  it("keeps the sandbox's recipe apart from the realm's", async () => {
    renderPanel({ sandbox: true });
    await generateFirst();
    expect(loadWorldRecipe(`sandbox:${REALM}`)).not.toBeNull();
    expect(loadWorldRecipe(REALM)).toBeNull();
  });
});
