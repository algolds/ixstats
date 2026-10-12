/**
 * A world that cannot be used, and the relief step after one is applied (the apply region of the World tab): the
 * server's refusals read in plain words, with Retry and the draft kept. A failed relief step offers Rebuild relief,
 * also after a reload.
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

import {
  applyWorld,
  calls,
  failRead,
  invalidated,
  rebuildRelief,
  setJob,
  start,
} from "~/tests/helpers/fake-map-import";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import {
  DRAFT,
  REALM,
  STATUS,
  applied,
  claimsLock,
  reachReview,
  refusal,
  renderRegion,
  resetWorldApplyTests,
  respondToUpload,
  startCheck,
  getUseButton,
} from "~/tests/helpers/world-apply-fixtures";

beforeEach(resetWorldApplyTests);
afterEach(() => jest.restoreAllMocks());
describe("a refusal", () => {
  it("says the upload was refused, in the server's words, and keeps the draft", async () => {
    respondToUpload({
      status: 409,
      body: { error: "The world is locked: 2 claims are pending or approved in this realm" },
    });
    const { onDiscardDraft } = renderRegion();
    fireEvent.click(getUseButton());
    expect(await screen.findByText("The realm can't take a world right now.")).toBeInTheDocument();
    expect(
      screen.getByText("The world is locked: 2 claims are pending or approved in this realm")
    ).toBeInTheDocument();
    expect(screen.getByText("Your preview is kept.")).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
    expect(onDiscardDraft).not.toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
  });

  it.each([
    ["FORBIDDEN", "You can't change this realm's world."],
    ["BAD_REQUEST", "The server refused this world."],
    ["NOT_FOUND", "The realm or the uploaded world was not found."],
    ["CONFLICT", "The realm can't take a world right now."],
  ])("words a %s refusal of the check", async (code, title) => {
    start.mockRejectedValue(refusal("Ixnay's map is hand drawn", code));
    renderRegion();
    fireEvent.click(getUseButton());
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText("Ixnay's map is hand drawn")).toBeInTheDocument();
  });

  it("says the check failed when the job did, with the reason it gives", async () => {
    renderRegion();
    await startCheck();
    act(() =>
      setJob("j_check", {
        status: "failed",
        progress: 12,
        stage: null,
        error: "The bundle has an open ring in rivers",
      })
    );
    expect(await screen.findByText("The world could not be checked.")).toBeInTheDocument();
    expect(screen.getByText("The bundle has an open ring in rivers")).toBeInTheDocument();
    expect(screen.getByText("Your preview is kept.")).toBeInTheDocument();
  });

  it("says so when the check cannot be read at all", async () => {
    renderRegion();
    await startCheck();
    act(() => failRead("j_check", { message: "Import not found", data: { code: "NOT_FOUND" } }));
    expect(
      await screen.findByText("The realm or the uploaded world was not found.")
    ).toBeInTheDocument();
    expect(screen.getByText("Import not found")).toBeInTheDocument();
  });

  it("words a refusal of the apply, and keeps the draft", async () => {
    applyWorld.mockRejectedValue(
      refusal("The world is locked: 1 claim is pending or approved in this realm", "CONFLICT")
    );
    const { onDiscardDraft } = renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    expect(await screen.findByText("The realm can't take a world right now.")).toBeInTheDocument();
    expect(screen.getByText(/1 claim is pending or approved/)).toBeInTheDocument();
    expect(onDiscardDraft).not.toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
  });

  it("says the apply failed when its job did, and keeps the draft", async () => {
    const { onDiscardDraft } = renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() =>
      setJob("j_apply", {
        status: "failed",
        progress: 60,
        stage: null,
        error: "A nation was claimed while the world was being applied",
      })
    );
    expect(await screen.findByText("The world could not be applied.")).toBeInTheDocument();
    expect(
      screen.getByText("A nation was claimed while the world was being applied")
    ).toBeInTheDocument();
    expect(onDiscardDraft).not.toHaveBeenCalled();
    expect(screen.queryByText("The world is applied")).toBeNull();
  });

  it("says a bundle that cannot be built, naming the layer", async () => {
    const { rivers: _rivers, ...layers } = DRAFT.layers;
    renderRegion({ result: worldResult({ layers }) });
    fireEvent.click(getUseButton());
    expect(await screen.findByText("The world could not be sent.")).toBeInTheDocument();
    expect(screen.getByText("The preview has no rivers layer")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("tries the whole flow again on Retry, from the upload", async () => {
    respondToUpload({ status: 500, body: { error: "Upload failed" } });
    renderRegion();
    fireEvent.click(getUseButton());
    await screen.findByText("The world could not be sent.");
    respondToUpload();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Checking the world/);
    expect(calls).toEqual(["upload", "upload", "start"]);
  });

  it("retries a failed apply from a new check, since the realm may have changed", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() =>
      setJob("j_apply", { status: "failed", progress: 60, stage: null, error: "Interrupted" })
    );
    await screen.findByText("The world could not be applied.");
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(calls.filter((call) => call === "applyWorld")).toHaveLength(1);
  });

  it("will not retry while the claims lock the realm", async () => {
    const view = renderRegion();
    respondToUpload({ status: 500, body: {} });
    fireEvent.click(getUseButton());
    await screen.findByText("The world could not be sent.");
    view.update({ lock: claimsLock() });
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  it("closes the message and offers Use this world again", async () => {
    respondToUpload({ status: 500, body: {} });
    renderRegion();
    fireEvent.click(getUseButton());
    await screen.findByText("The world could not be sent.");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(getUseButton()).toBeInTheDocument();
  });
});

describe("rebuilding the relief", () => {
  const REBUILD = { name: "Rebuild relief" };

  it("is not offered while the relief was built", async () => {
    renderRegion();
    expect(screen.queryByRole("button", REBUILD)).toBeNull();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() => setJob("j_apply", applied()));
    await screen.findByText("The world is applied");
    expect(screen.queryByRole("button", REBUILD)).toBeNull();
  });

  it("is offered right after an apply whose relief step failed, with what the build said", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() =>
      setJob(
        "j_apply",
        applied({ status: "failed", version: null, tiles: 0, error: "sharp ran out of memory" })
      )
    );
    await screen.findByText("The world is applied");
    expect(screen.getByText("The relief was not built")).toBeInTheDocument();
    expect(screen.getByText(/sharp ran out of memory/)).toBeInTheDocument();
    expect(screen.getByRole("button", REBUILD)).toBeEnabled();
  });

  it("is offered after a reload, from the realm's status, with no draft", () => {
    renderRegion({
      result: null,
      lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } },
    });
    expect(screen.getByText("The relief was not built")).toBeInTheDocument();
    expect(screen.getByRole("button", REBUILD)).toBeInTheDocument();
  });

  it("is offered even while claims lock the realm: it leaves the nations alone", () => {
    renderRegion({
      lock: {
        phase: "ready",
        status: { ...STATUS, locked: true, lockReason: "claims", reliefFailed: true },
      },
    });
    expect(screen.getByRole("button", REBUILD)).toBeEnabled();
  });

  it("is not offered for an archived realm, which can't change", () => {
    renderRegion({
      result: null,
      lock: {
        phase: "ready",
        status: { ...STATUS, locked: true, lockReason: "archived", reliefFailed: true },
      },
    });
    expect(screen.queryByRole("button", REBUILD)).toBeNull();
  });

  it("is offered again when a later world's relief also fails, after this one was rebuilt", async () => {
    const view = renderRegion({
      result: null,
      lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } },
    });
    fireEvent.click(screen.getByRole("button", REBUILD));
    await screen.findByText("The relief was rebuilt.");
    view.update({ lock: { phase: "ready", status: STATUS } });
    view.update({ lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } } });
    expect(screen.getByRole("button", REBUILD)).toBeInTheDocument();
    expect(screen.queryByText("The relief was rebuilt.")).toBeNull();
  });

  it("keeps saying the relief was rebuilt while the status has not caught up", async () => {
    const view = renderRegion({
      result: null,
      lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } },
    });
    fireEvent.click(screen.getByRole("button", REBUILD));
    await screen.findByText("The relief was rebuilt.");
    view.update({ lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } } });
    expect(screen.queryByRole("button", REBUILD)).toBeNull();
  });

  it("builds the relief of the realm, shows it is working, then says it was rebuilt and refreshes the map", async () => {
    let finish: (value: object) => void = () => {};
    rebuildRelief.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderRegion({
      result: null,
      lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } },
    });
    fireEvent.click(screen.getByRole("button", REBUILD));
    expect(rebuildRelief).toHaveBeenCalledWith({ realmId: REALM });
    expect(screen.getByRole("button", { name: "Building relief" })).toBeDisabled();
    await act(async () => finish({ source: "cells", version: "abc12345", built: true, tiles: 12 }));
    expect(await screen.findByText("The relief was rebuilt.")).toBeInTheDocument();
    expect(screen.queryByRole("button", REBUILD)).toBeNull();
    expect(invalidated.display).toHaveBeenCalled();
    expect(invalidated.version).toHaveBeenCalled();
    expect(invalidated.worldStatus).toHaveBeenCalled();
  });

  it("says why it failed, in the server's words, and tries again", async () => {
    rebuildRelief.mockRejectedValueOnce(
      refusal("Another import of this realm is running. Try again when it has finished", "CONFLICT")
    );
    renderRegion({
      result: null,
      lock: { phase: "ready", status: { ...STATUS, reliefFailed: true } },
    });
    fireEvent.click(screen.getByRole("button", REBUILD));
    expect(await screen.findByText(/Another import of this realm is running/)).toBeInTheDocument();
    expect(screen.getByText(/The relief can't be rebuilt right now\./)).toBeInTheDocument();
    expect(screen.queryByText(/take a world/)).toBeNull();
    expect(invalidated.display).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", REBUILD));
    expect(await screen.findByText("The relief was rebuilt.")).toBeInTheDocument();
    expect(rebuildRelief).toHaveBeenCalledTimes(2);
  });
});
