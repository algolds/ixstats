/**
 * A World tab that was left or reloaded while a world was being checked or applied picks the job up again: it follows
 * the job to its end, and when the world is applied the draft goes off the map and the maps are asked again, whichever
 * tab was open when the job landed. A refusal is shown with the draft kept; a job that is gone is let go.
 */
import { act, fireEvent, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-map-import");
  return { api: { useUtils: fake.useUtils, geoEditor: fake.geoEditor } };
});
// jsdom has no CompressionStream; the bytes only need to exist
jest.mock("~/lib/maps/import/world-bundle", () => ({
  ...jest.requireActual("~/lib/maps/import/world-bundle"),
  encodeWorldBundle: jest.fn(),
}));

import { draftKey } from "~/lib/worldgen/world-apply";
import { loadWorldJob, saveWorldJob } from "~/lib/worldgen/world-draft-recipe";
import {
  applyWorld,
  invalidated,
  setJob,
  start,
} from "~/tests/helpers/fake-map-import";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import {
  CHECKED_MAP,
  DRAFT,
  REALM,
  applied,
  dryRun,
  reachReview,
  renderRegion,
  resetWorldApplyTests,
  startCheck,
  getUseButton,
} from "~/tests/helpers/world-apply-fixtures";

beforeEach(resetWorldApplyTests);
afterEach(() => jest.restoreAllMocks());

const KEY = draftKey(DRAFT, "preset");

/** The tab is left in the middle of an apply: the apply is running on the server and the job is stored. */
async function leaveMidApply() {
  const first = renderRegion();
  await reachReview();
  fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
  await screen.findByText(/Applying the world/);
  act(() => setJob("j_apply", { status: "running", progress: 50, stage: "Writing the map" }));
  first.unmount();
}

describe("the job in flight is stored", () => {
  it.each([
    [
      "a failed check",
      async () => {
        renderRegion();
        await startCheck();
        act(() => setJob("j_check", { status: "failed", progress: 5, stage: null, error: "No" }));
        await screen.findByText("The world could not be checked.");
      },
    ],
    [
      "a failed apply",
      async () => {
        renderRegion();
        await reachReview();
        fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
        await screen.findByText(/Applying the world/);
        act(() => setJob("j_apply", { status: "failed", progress: 5, stage: null, error: "No" }));
        await screen.findByText("The world could not be applied.");
      },
    ],
    [
      "an apply the server refused",
      async () => {
        applyWorld.mockRejectedValue(
          Object.assign(new Error("Locked"), { data: { code: "CONFLICT" } })
        );
        renderRegion();
        await reachReview();
        fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
        await screen.findByText("The realm can't take a world right now.");
      },
    ],
    [
      "a review that was cancelled",
      async () => {
        renderRegion();
        await reachReview();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      },
    ],
    [
      "a failure that was closed",
      async () => {
        renderRegion();
        await startCheck();
        act(() => setJob("j_check", { status: "failed", progress: 5, stage: null, error: "No" }));
        fireEvent.click(await screen.findByRole("button", { name: "Close" }));
      },
    ],
  ])("forgotten after %s", async (_name, play) => {
    await play();
    expect(loadWorldJob(REALM)).toBeNull();
  });
});

describe("a tab left while a world is applied", () => {
  it("finds the apply still running when it returns, and follows it to the end", async () => {
    await leaveMidApply();
    const back = renderRegion();
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();
    expect(screen.getByText(/Applying the world: Writing the map/)).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(back.onDiscardDraft).not.toHaveBeenCalled();

    act(() => setJob("j_apply", applied()));
    expect(await screen.findByText("The world is applied")).toBeInTheDocument();
    expect(back.onDiscardDraft).toHaveBeenCalledTimes(1);
    expect(invalidated.version).toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
  });

  it("runs the whole success handling when the apply landed while the tab was away", async () => {
    await leaveMidApply();
    act(() => setJob("j_apply", applied()));
    // nothing was open to see it land: the draft is still on the map, the maps were not asked again
    expect(invalidated.version).not.toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toMatchObject({ applyJobId: "j_apply" });

    const back = renderRegion();
    expect(await screen.findByText("The world is applied")).toBeInTheDocument();
    expect(
      screen.getByText("140 map features written, 12 nations created, 3 nations retired.")
    ).toBeInTheDocument();
    expect(back.onDiscardDraft).toHaveBeenCalledTimes(1);
    expect(invalidated.version).toHaveBeenCalled();
    expect(invalidated.display).toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
  });
  it("shows the failure when the apply failed while the tab was away, with the draft kept", async () => {
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
    expect(await screen.findByText("The world could not be applied.")).toBeInTheDocument();
    expect(
      screen.getByText("A nation was claimed while the world was being applied")
    ).toBeInTheDocument();
    expect(screen.getByText("Your preview is kept.")).toBeInTheDocument();
    expect(back.onDiscardDraft).not.toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
    // Retry starts over, from a new check
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Checking the world/);
    expect(start).toHaveBeenCalledTimes(2);
  });
  it("follows the job of its own realm only", async () => {
    saveWorldJob("r_other", { checkJobId: "j_other", applyJobId: "j_other_apply", draftKey: KEY });
    renderRegion();
    expect(getUseButton()).toBeEnabled();
  });
});

describe("a tab left while a world is checked", () => {
  async function leaveMidCheck() {
    const first = renderRegion();
    await startCheck();
    first.unmount();
  }

  it("will not apply a check to a preview of another world", async () => {
    await leaveMidCheck();
    act(() => setJob("j_check", dryRun()));
    renderRegion({ result: worldResult({ seed: 8 }) });
    expect(await screen.findByText(/The preview changed after this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
  });
});

describe("a tab left on a review while the map was edited", () => {
  const { political: _political, ...layers } = DRAFT.layers;
  /** A preview fitted to the realm's own map, made from the recipe: the same seed and parameters every time. */
  const fitted = () => worldResult({ seed: 7, layers, slots: [] });
  const FITTED_KEY = draftKey(fitted(), "realm-map");

  async function leaveOnReview() {
    const first = renderRegion({ source: "realm-map", result: fitted(), mapVersion: CHECKED_MAP });
    await reachReview(dryRun({ source: "realm-map" }));
    first.unmount();
  }

  it("will not apply the old check to the edited map, though the preview is fitted to it from the same recipe", async () => {
    await leaveOnReview();
    expect(loadWorldJob(REALM)).toMatchObject({ draftKey: FITTED_KEY });
    renderRegion({ source: "realm-map", result: fitted(), mapVersion: CHECKED_MAP + 1 });
    expect(await screen.findByText(/The realm's map changed after this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await screen.findByText(/Checking the world/);
    expect(start).toHaveBeenCalledTimes(2);
    expect(applyWorld).not.toHaveBeenCalled();
  });
  it("holds a preset check too when the map moved, since its diff no longer holds", async () => {
    const first = renderRegion({ mapVersion: CHECKED_MAP });
    await reachReview();
    first.unmount();
    renderRegion({ mapVersion: CHECKED_MAP + 3 });
    expect(await screen.findByText(/The realm's map changed after this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
  });
});

describe("a stored job that is not this realm's", () => {
  it("is let go, as if it were gone, and not followed", async () => {
    saveWorldJob(REALM, { checkJobId: "j_x", applyJobId: "j_x_apply", draftKey: KEY });
    setJob("j_x_apply", { ...applied(), realmId: "r_other" });
    const back = renderRegion();
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeEnabled();
    expect(screen.queryByText("The world is applied")).toBeNull();
    expect(back.onDiscardDraft).not.toHaveBeenCalled();
    expect(loadWorldJob(REALM)).toBeNull();
  });
});

describe("a world applied for a draft that moved on", () => {
  it("keeps the newer draft, and still shows the result", async () => {
    await leaveMidApply();
    act(() => setJob("j_apply", applied()));
    const back = renderRegion({ result: worldResult({ seed: 99 }) });
    expect(await screen.findByText("The world is applied")).toBeInTheDocument();
    expect(back.onDiscardDraft).not.toHaveBeenCalled();
    expect(invalidated.version).toHaveBeenCalled();
  });
});

describe("calling a job off", () => {
  it("does not offer to call off an apply that is running: it is all or nothing", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    act(() => setJob("j_apply", { status: "running", progress: 30, stage: "Creating nations" }));
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});
