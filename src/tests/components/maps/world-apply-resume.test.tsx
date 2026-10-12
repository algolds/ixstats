/**
 * A World tab that was left or reloaded while a world was being checked or applied picks the job up again: it follows
 * the job to its end, and when the world is applied the draft goes off the map and the maps are asked again, whichever
 * tab was open when the job landed. A refusal is shown with the draft kept; a job that is gone is let go.
 */
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

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
  cancelJob,
  failRead,
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
  it("with the check, then with the apply, and forgotten when the apply is over", async () => {
    renderRegion();
    expect(loadWorldJob(REALM)).toBeNull();
    await startCheck();
    expect(loadWorldJob(REALM)).toEqual({ checkJobId: "j_check", applyJobId: null, draftKey: KEY });
    act(() => setJob("j_check", dryRun()));
    await screen.findByText("What this world changes");
    expect(loadWorldJob(REALM)).toMatchObject({ applyJobId: null });
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(loadWorldJob(REALM)).toEqual({
      checkJobId: "j_check",
      applyJobId: "j_apply",
      draftKey: KEY,
    });
    act(() => setJob("j_apply", applied()));
    await screen.findByText("The world is applied");
    expect(loadWorldJob(REALM)).toBeNull();
  });

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

  it("kept while the review waits, so a tab left on the review finds it again", async () => {
    renderRegion();
    await reachReview();
    expect(loadWorldJob(REALM)).toMatchObject({ checkJobId: "j_check" });
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

  it("offers Rebuild relief for an apply whose relief failed while the tab was away", async () => {
    await leaveMidApply();
    act(() =>
      setJob("j_apply", applied({ status: "failed", version: null, tiles: 0, error: "No heights" }))
    );
    renderRegion();
    expect(await screen.findByText("The relief was not built")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rebuild relief" })).toBeInTheDocument();
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

  it("lets a job go that is no longer there, without a failure", async () => {
    saveWorldJob(REALM, { checkJobId: "j_old", applyJobId: "j_old_apply", draftKey: KEY });
    failRead("j_old_apply", { message: "Import not found", data: { code: "NOT_FOUND" } });
    renderRegion();
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeEnabled();
    expect(screen.queryByText(/could not be/)).toBeNull();
    expect(loadWorldJob(REALM)).toBeNull();
  });

  it("shows a job that cannot be read for another reason as a failure, not as gone", async () => {
    saveWorldJob(REALM, { checkJobId: "j_old", applyJobId: "j_old_apply", draftKey: KEY });
    failRead("j_old_apply", {
      message: "Database is down",
      data: { code: "INTERNAL_SERVER_ERROR" },
    });
    renderRegion();
    expect(await screen.findByText("The world could not be applied.")).toBeInTheDocument();
    expect(screen.getByText("Database is down")).toBeInTheDocument();
  });

  it("does not follow a job it was never given: a realm without a stored job starts at Use this world", () => {
    renderRegion();
    expect(getUseButton()).toBeEnabled();
  });

  it("follows the job of its own realm only", async () => {
    saveWorldJob("r_other", { checkJobId: "j_other", applyJobId: "j_other_apply", draftKey: KEY });
    renderRegion();
    expect(getUseButton()).toBeEnabled();
  });

  it("drops a stored job that is not a job", () => {
    window.localStorage.setItem(`ixworld-world-job:${REALM}`, "{oops");
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

  it("shows the review when it returns and the check has finished, and applies that check", async () => {
    await leaveMidCheck();
    act(() => setJob("j_check", dryRun()));
    renderRegion();
    expect(await screen.findByText("What this world changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(applyWorld).toHaveBeenCalledWith({ jobId: "j_check" });
  });

  it("keeps following a check that is still running", async () => {
    await leaveMidCheck();
    act(() =>
      setJob("j_check", { status: "running", progress: 40, stage: "Checking the borders" })
    );
    renderRegion();
    expect(screen.getByText(/Checking the borders/)).toBeInTheDocument();
  });

  it("takes the preview made again from the same recipe for the world that was checked", async () => {
    await leaveMidCheck();
    act(() => setJob("j_check", dryRun()));
    // the tab regenerates the draft from its recipe: the same world, a new object
    renderRegion({ result: worldResult({ seed: 7 }) });
    expect(await screen.findByRole("button", { name: "Apply this world" })).toBeEnabled();
  });

  it("will not apply a check to a preview of another world", async () => {
    await leaveMidCheck();
    act(() => setJob("j_check", dryRun()));
    renderRegion({ result: worldResult({ seed: 8 }) });
    expect(await screen.findByText(/The preview changed after this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
  });

  it("waits for the preview to be made again before it offers Apply", async () => {
    await leaveMidCheck();
    act(() => setJob("j_check", dryRun()));
    const back = renderRegion({ result: null, generating: true, stale: true });
    expect(await screen.findByText("What this world changes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
    back.update({ result: worldResult({ seed: 7 }), generating: false, stale: false });
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeEnabled();
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

  it("applies the check when the map is as it was", async () => {
    await leaveOnReview();
    renderRegion({ source: "realm-map", result: fitted(), mapVersion: CHECKED_MAP });
    expect(await screen.findByRole("button", { name: "Apply this world" })).toBeEnabled();
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
  it("calls off the check and goes back to Use this world", async () => {
    cancelJob.mockResolvedValue({ cancelled: true });
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeInTheDocument();
    expect(cancelJob).toHaveBeenCalledWith({ jobId: "j_check" });
    expect(loadWorldJob(REALM)).toBeNull();
  });

  it("calls off an apply that is only queued", async () => {
    cancelJob.mockResolvedValue({ cancelled: true });
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() => setJob("j_apply", { status: "queued", progress: 0, stage: null }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeInTheDocument();
    expect(cancelJob).toHaveBeenCalledWith({ jobId: "j_apply" });
  });

  it("does not offer to call off an apply that is running: it is all or nothing", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    act(() => setJob("j_apply", { status: "running", progress: 30, stage: "Creating nations" }));
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("does not offer it while the apply is being queued", async () => {
    let queued: (value: object) => void = () => {};
    applyWorld.mockReturnValue(new Promise((resolve) => (queued = resolve)));
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    await act(async () => queued({ jobId: "j_apply" }));
  });

  it("says when the job could not be called off for another reason, and lets Cancel be pressed again", async () => {
    cancelJob.mockRejectedValueOnce(new Error("Too many requests"));
    cancelJob.mockResolvedValueOnce({ cancelled: true });
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The job could not be called off: Too many requests"
    );
    expect(screen.getByText(/Checking the world/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says nothing of a cancel that found the job already finished (a conflict), and keeps following it", async () => {
    cancelJob.mockRejectedValue(
      Object.assign(new Error("The import has already finished"), { data: { code: "CONFLICT" } })
    );
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelJob).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/could not be called off/)).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("says when a queued apply could not be called off, on the apply's progress", async () => {
    cancelJob.mockRejectedValue(new Error("Too many requests"));
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() => setJob("j_apply", { status: "queued", progress: 0, stage: null }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The job could not be called off: Too many requests"
    );
    expect(screen.getByText(/Applying the world/)).toBeInTheDocument();
  });

  it("does not carry a failed cancel's message into the next job", async () => {
    cancelJob.mockRejectedValue(new Error("Too many requests"));
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("alert");
    // the check lands anyway, and the person goes on to apply it
    act(() => setJob("j_check", dryRun()));
    await screen.findByText("What this world changes");
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/could not be called off/)).toBeNull();
  });

  it("does not carry it into a new check started with Retry", async () => {
    cancelJob.mockRejectedValue(new Error("Too many requests"));
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("alert");
    act(() => setJob("j_check", { status: "failed", progress: 9, stage: null, error: "No" }));
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await screen.findByText(/Checking the world/);
    expect(screen.queryByText(/could not be called off/)).toBeNull();
  });

  it("drops the old message when Cancel is pressed again and finds the job finished", async () => {
    cancelJob.mockRejectedValueOnce(new Error("Too many requests"));
    cancelJob.mockRejectedValueOnce(
      Object.assign(new Error("The import has already finished"), { data: { code: "CONFLICT" } })
    );
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelJob).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows how the check ended when it had finished before it could be called off", async () => {
    cancelJob.mockRejectedValue(
      Object.assign(new Error("The import has already finished"), { data: { code: "CONFLICT" } })
    );
    renderRegion();
    await startCheck();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    act(() => setJob("j_check", dryRun()));
    expect(await screen.findByText("What this world changes")).toBeInTheDocument();
  });
});
