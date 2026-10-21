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
  invalidated,
  rebuildRelief,
  setJob,
  start,
} from "~/tests/helpers/fake-map-import";
import {
  REALM,
  STATUS,
  claimsLock,
  reachReview,
  refusal,
  renderRegion,
  resetWorldApplyTests,
  respondToUpload,
  getUseButton,
} from "~/tests/helpers/world-apply-fixtures";

beforeEach(resetWorldApplyTests);
afterEach(() => jest.restoreAllMocks());
describe("a refusal", () => {
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
});

describe("rebuilding the relief", () => {
  const REBUILD = { name: "Rebuild relief" };
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
});
