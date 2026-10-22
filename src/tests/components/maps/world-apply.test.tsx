/**
 * The founder's world apply flow (the World tab and its apply region): Use this world uploads the draft and queues the
 * check, Apply writes it, and the draft goes only once the world is on the map. A check is never applied to anything
 * but what was checked: the preview, the realm's map version and the layer choice must all still hold, also for a tab
 * that comes back to a job it left; a job of another realm is let go. Two presses make one check, two confirmations one
 * apply. A refused or failed apply keeps the draft and a retry checks again; claims lock the realm. An applied world is
 * never covered again by the old draft, and a world fitted to a partial or moved map is never made or applied.
 *
 * Folds: src/tests/components/maps/world-apply-resume.test.tsx, src/tests/components/maps/world-apply-refusals.test.tsx,
 * src/tests/components/maps/world-apply-layers.test.tsx, src/tests/components/maps/use-world-apply.test.tsx,
 * src/tests/components/maps/world-panel-apply.test.tsx, src/tests/components/maps/world-panel-map.test.tsx
 */
import { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react";

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
// jsdom has no CompressionStream; the bytes only need to exist
jest.mock("~/lib/maps/import/world-bundle", () => ({
  ...jest.requireActual("~/lib/maps/import/world-bundle"),
  encodeWorldBundle: jest.fn(),
}));
jest.mock("~/hooks/useWorldPreview", () => ({ useWorldPreview: jest.fn() }));
jest.mock("~/hooks/useMapLayerData", () => ({
  useDecodedMapLayers: jest.fn(),
  useRetryMapLayers: jest.fn(),
}));
// The real region, called through, so the panel's props to it can be read
jest.mock("~/components/maps/editor/panels/WorldApplyRegion", () => {
  const actual = jest.requireActual("~/components/maps/editor/panels/WorldApplyRegion");
  return { ...actual, WorldApplyRegion: jest.fn(actual.WorldApplyRegion) };
});

import { encodeWorldBundle } from "~/lib/maps/import/world-bundle";
import type { WorldApplyRegionProps } from "~/components/maps/editor/panels/WorldApplyRegion";
import { WorldPanel } from "~/components/maps/editor/panels/WorldPanel";
import { useWorldApply } from "~/components/maps/editor/hooks/useWorldApply";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { draftKey } from "~/lib/worldgen/world-apply";
import { controlsForPreset } from "~/lib/worldgen/world-controls";
import {
  loadWorldJob,
  loadWorldRecipe,
  saveWorldJob,
  saveWorldRecipe,
} from "~/lib/worldgen/world-draft-recipe";
import { applyWorld, calls, invalidated, setJob, start } from "~/tests/helpers/fake-map-import";
import { resultMessage, worldResult } from "~/tests/helpers/fake-world-worker";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import {
  CHECKED_MAP,
  DRAFT,
  REALM,
  applied,
  claimsLock,
  dryRun,
  getUseButton,
  reachReview,
  refusal,
  renderRegion,
  resetWorldApplyTests,
  startCheck,
} from "~/tests/helpers/world-apply-fixtures";
import {
  cleanUpPanelTests,
  factory,
  lastRequest,
  layersQuery,
  mapLayers,
  region,
  renderPanel,
  requestCount,
  resetPanelTests,
  workers,
} from "~/tests/helpers/world-panel-fixtures";

beforeAll(stubResizeObserver);
afterEach(() => jest.restoreAllMocks());

const { political: _political, ...unpoliticalLayers } = DRAFT.layers;
/** A preview fitted to the realm's own map at the checked version, made from the recipe: the same every time. */
const fitted = () => worldResult({ seed: 7, layers: unpoliticalLayers, slots: [] });
const FITTED: Partial<WorldApplyRegionProps> = {
  source: "realm-map",
  result: fitted(),
  mapVersion: CHECKED_MAP,
};
const FITTED_CHECK = () => dryRun({ source: "realm-map" });

const applyButton = () => screen.queryByRole("button", { name: "Apply this world" });
async function pressApply() {
  fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
  await screen.findByText(/Applying the world/);
}

describe("the apply region", () => {
  beforeEach(resetWorldApplyTests);

  it("checks the world against the map version it was fitted to, applies it, and takes the draft off the map only once it is applied", async () => {
    const { onDiscardDraft } = renderRegion(FITTED);
    await reachReview(FITTED_CHECK());
    expect(calls).toEqual(["upload", "start"]);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "world", fittedMapVersion: CHECKED_MAP })
    );

    await pressApply();
    expect(calls).toEqual(["upload", "start", "applyWorld"]);
    act(() => setJob("j_apply", { status: "running", progress: 45, stage: "Writing the map" }));
    expect(onDiscardDraft).not.toHaveBeenCalled();

    act(() => setJob("j_apply", applied()));
    await screen.findByText("The world is applied");
    expect(onDiscardDraft).toHaveBeenCalledTimes(1);
    expect(invalidated.version).toHaveBeenCalled();
    expect(invalidated.display).toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
  });

  it("keeps a draft that changed while the world was being applied", async () => {
    const view = renderRegion();
    await reachReview();
    await pressApply();
    view.update({ result: worldResult({ seed: 99 }) });
    act(() => setJob("j_apply", applied()));
    await screen.findByText("The world is applied");
    expect(view.onDiscardDraft).not.toHaveBeenCalled();
  });

  it.each<[string, Partial<WorldApplyRegionProps>, Partial<WorldApplyRegionProps>, () => void]>([
    [
      "the preview changed",
      {},
      { result: worldResult({ seed: 8 }) },
      () => expect(jest.mocked(encodeWorldBundle).mock.lastCall![0]).toMatchObject({ seed: 8 }),
    ],
    [
      "the realm's map moved under the same fitted preview",
      FITTED,
      { mapVersion: CHECKED_MAP + 1 },
      () =>
        expect(start).toHaveBeenLastCalledWith(
          expect.objectContaining({ fittedMapVersion: CHECKED_MAP + 1 })
        ),
    ],
    [
      "the admin's layer choice changed",
      { ...FITTED, layers: ["altitudes"] },
      { layers: ["altitudes", "lakes"] },
      () =>
        expect(start).toHaveBeenLastCalledWith(
          expect.objectContaining({ options: { layers: ["altitudes", "lakes"] } })
        ),
    ],
  ])(
    "will not apply a check once %s: it offers Check again, which checks what is there now",
    async (_name, initial, change, rechecked) => {
      const view = renderRegion(initial);
      await reachReview(initial.source === "realm-map" ? FITTED_CHECK() : dryRun());
      expect(applyButton()).toBeEnabled();
      view.update(change);
      expect(screen.getByRole("status")).toHaveTextContent("changed after this check");
      expect(applyButton()).toBeNull();
      start.mockResolvedValue({ jobId: "j_check_2" });
      fireEvent.click(screen.getByRole("button", { name: "Check again" }));
      await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      rechecked();
      expect(applyWorld).not.toHaveBeenCalled();
    }
  );

  it("turns Apply off if claims lock the realm while the review is open", async () => {
    const view = renderRegion();
    await reachReview();
    view.update({ lock: claimsLock() });
    const apply = screen.getByRole("button", { name: "Apply this world" });
    expect(apply).toBeDisabled();
    fireEvent.click(apply);
    expect(applyWorld).not.toHaveBeenCalled();
  });

  it("keeps the draft when the server refuses the apply, and reads the lock again", async () => {
    applyWorld.mockRejectedValue(
      refusal("The world is locked: 1 claim is pending or approved in this realm", "CONFLICT")
    );
    const { onDiscardDraft } = renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    expect(await screen.findByText(/1 claim is pending or approved/)).toBeInTheDocument();
    expect(onDiscardDraft).not.toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
  });

  it("starts one check for two presses, and queues one apply for two confirmations, none before the check", async () => {
    const { result } = renderHook(() =>
      useWorldApply({ realmId: REALM, result: DRAFT, source: "preset", onApplied: jest.fn() })
    );
    await act(async () => result.current.confirm());
    expect(applyWorld).not.toHaveBeenCalled();

    await act(async () => {
      void result.current.begin();
      void result.current.begin();
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => setJob("j_check", dryRun()));
    expect(result.current.view.stage).toBe("review");
    await act(async () => {
      void result.current.confirm();
      void result.current.confirm();
    });
    expect(applyWorld).toHaveBeenCalledTimes(1);
  });
});

describe("a tab that comes back to a job it left", () => {
  beforeEach(resetWorldApplyTests);

  /** The tab is left in the middle of an apply: the apply is running on the server and the job is stored. */
  async function leaveMidApply() {
    const first = renderRegion();
    await reachReview();
    await pressApply();
    act(() => setJob("j_apply", { status: "running", progress: 50, stage: "Writing the map" }));
    first.unmount();
  }

  it("runs the whole success handling when the apply landed while the tab was away", async () => {
    await leaveMidApply();
    act(() => setJob("j_apply", applied()));
    // nothing was open to see it land: the draft is still on the map, the maps were not asked again
    expect(invalidated.version).not.toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toMatchObject({ applyJobId: "j_apply" });

    const back = renderRegion();
    await screen.findByText("The world is applied");
    expect(back.onDiscardDraft).toHaveBeenCalledTimes(1);
    expect(invalidated.version).toHaveBeenCalled();
    expect(invalidated.display).toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
  });

  it("keeps the draft when the apply failed while the tab was away, and retries from a new check", async () => {
    await leaveMidApply();
    act(() =>
      setJob("j_apply", {
        status: "failed",
        progress: 60,
        stage: null,
        error: "A nation was claimed while the world was being applied",
      })
    );
    const back = renderRegion();
    expect(
      await screen.findByText("A nation was claimed while the world was being applied")
    ).toBeInTheDocument();
    expect(back.onDiscardDraft).not.toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Checking the world/);
    expect(start).toHaveBeenCalledTimes(2);
    expect(calls.filter((call) => call === "applyWorld")).toHaveLength(1);
  });

  it("will not apply a check it left to a preview of another world", async () => {
    const first = renderRegion();
    await startCheck();
    first.unmount();
    act(() => setJob("j_check", dryRun()));
    renderRegion({ result: worldResult({ seed: 8 }) });
    expect(await screen.findByText(/The preview changed after this check/)).toBeInTheDocument();
    expect(applyButton()).toBeNull();
  });

  it("lets go of a stored job that is another realm's, and follows nothing", async () => {
    saveWorldJob(REALM, {
      checkJobId: "j_x",
      applyJobId: "j_x_apply",
      draftKey: draftKey(DRAFT, "preset"),
    });
    setJob("j_x_apply", { ...applied(), realmId: "r_other" });
    const back = renderRegion();
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeEnabled();
    expect(screen.queryByText("The world is applied")).toBeNull();
    expect(back.onDiscardDraft).not.toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
  });
});

describe("the World tab around the apply region", () => {
  beforeEach(resetPanelTests);
  afterEach(cleanUpPanelTests);

  const sourceControl = () => screen.getByRole("radiogroup", { name: "Source" });
  const fitToTheMap = () =>
    fireEvent.click(within(sourceControl()).getByRole("radio", { name: "This realm's map" }));
  const deliver = () => act(() => workers.at(-1)!.say(resultMessage(lastRequest().id)));
  const rerender = (view: ReturnType<typeof renderPanel>) =>
    view.rerender(<WorldPanel map={null} createWorker={factory} />);

  it("does not bring the old draft back over a world applied while the tab was away, and forgets its recipe", () => {
    // The world the recipe makes again: seed 31 with the generator's defaults
    const params = { ...DEFAULT_PARAMS, seed: 31 };
    saveWorldRecipe(REALM, { seed: 31, controls: controlsForPreset("ixnay") });
    saveWorldJob(REALM, {
      checkJobId: "j_check",
      applyJobId: "j_apply",
      draftKey: draftKey(worldResult({ seed: 31, params }), "preset"),
    });
    setJob("j_apply", applied());
    renderPanel();
    expect(screen.getByText("The world is applied")).toBeInTheDocument();
    expect(requestCount()).toBe(0);
    expect(loadWorldRecipe(REALM)).toBeNull();
    expect(loadWorldJob(REALM)).toBeNull();
  });

  it("makes no world from the realm's map while it is arriving, and holds a fitted one back once the map moves", () => {
    saveWorldRecipe(REALM, {
      seed: 9,
      controls: { ...controlsForPreset("earthlike"), source: "realm-map" },
    });
    // The political layer is in, the rest is not: not a map to fit a world around yet
    layersQuery.mockReturnValue(mapLayers({ pending: true }));
    const view = renderPanel();
    expect(requestCount()).toBe(0);

    layersQuery.mockReturnValue(mapLayers({ background: 3, altitudes: 2 }));
    rerender(view);
    expect(requestCount()).toBe(1);
    expect(lastRequest().landMaskLayers?.altitudes?.features).toHaveLength(2);
    deliver();
    expect(getUseButton()).toBeEnabled();

    // The map's version moves: the draft is stale until it is fitted again
    layersQuery.mockReturnValue(mapLayers({ pending: true }));
    rerender(view);
    expect(region.mock.lastCall![0].stale).toBe(true);
    expect(getUseButton()).toBeDisabled();
  });

  it("holds back Use this world for a draft fitted to the map when one of its layers fails to load", () => {
    const view = renderPanel();
    fitToTheMap();
    deliver();
    expect(getUseButton()).toBeEnabled();
    layersQuery.mockReturnValue(
      mapLayers({ error: new Error("Map layer altitudes could not be loaded (500)") })
    );
    rerender(view);
    expect(getUseButton()).toBeDisabled();
  });
});
