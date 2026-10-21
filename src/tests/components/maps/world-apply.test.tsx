/**
 * Using a generated world (the apply region of the World tab): Use this world uploads the draft and queues the check,
 * the dry run's diff is shown, Apply writes it, and the draft goes when the world is on the map. Applying is off with a
 * reason while the draft is out of date or the claims lock the realm or cannot be read. (Refusals and the relief
 * rebuild are in world-apply-refusals.test.tsx.)
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

import { encodeWorldBundle } from "~/lib/maps/import/world-bundle";
import type {
  WorldApplyRegionProps
} from "~/components/maps/editor/panels/WorldApplyRegion";
import { applyWorld, calls, invalidated, setJob, start } from "~/tests/helpers/fake-map-import";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import {
  CHECKED_MAP,
  DRAFT,
  STATUS,
  applied,
  claimsLock,
  dryRun,
  reachReview,
  renderRegion,
  resetWorldApplyTests,
  startCheck,
  getUseButton,
} from "~/tests/helpers/world-apply-fixtures";

beforeEach(resetWorldApplyTests);
afterEach(() => jest.restoreAllMocks());

describe("using a world", () => {
  it("uploads the draft, queues the check, shows what it changes, then applies it and shows the result", async () => {
    const { onDiscardDraft } = renderRegion();
    await reachReview();
    expect(calls).toEqual(["upload", "start"]);

    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    expect(calls).toEqual(["upload", "start", "applyWorld"]);
    expect(onDiscardDraft).not.toHaveBeenCalled();

    act(() => setJob("j_apply", { status: "running", progress: 45, stage: "Writing the map" }));
    expect(screen.getByText(/Writing the map/)).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();

    act(() => setJob("j_apply", applied()));
    expect(await screen.findByText("The world is applied")).toBeInTheDocument();
    expect(
      screen.getByText("140 map features written, 12 nations created, 3 nations retired.")
    ).toBeInTheDocument();
    expect(screen.getByText("12 nations are open for claims.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the realm" })).toHaveAttribute(
      "href",
      "/r/eurth"
    );
  });
  it("sends the map version the draft was fitted to with the world, for the server to check", async () => {
    const { political: _political, ...layers } = DRAFT.layers;
    renderRegion({
      source: "realm-map",
      result: worldResult({ layers, slots: [] }),
      mapVersion: CHECKED_MAP,
    });
    await startCheck();
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "world", fittedMapVersion: CHECKED_MAP })
    );
  });
  it("takes the draft off the map and forgets its recipe only once the world is applied", async () => {
    const { onDiscardDraft } = renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
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
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    view.update({ result: worldResult({ seed: 99 }) });
    act(() => setJob("j_apply", applied()));
    await screen.findByText("The world is applied");
    expect(view.onDiscardDraft).not.toHaveBeenCalled();
  });
});

describe("the review", () => {
  it("will not apply a world other than the one checked: the preview changed, so check it again", async () => {
    const view = renderRegion();
    await reachReview();
    view.update({ result: worldResult({ seed: 8 }) });
    expect(screen.getByText(/The preview changed after this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(jest.mocked(encodeWorldBundle).mock.calls[1]![0]).toMatchObject({ seed: 8 });
  });
  it("will not apply a check of a map that has moved on since: the map changed, so check it again", async () => {
    const view = renderRegion({ mapVersion: CHECKED_MAP });
    await reachReview();
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeEnabled();
    view.update({ mapVersion: CHECKED_MAP + 1 });
    expect(screen.getByText(/The realm's map changed after this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
    start.mockResolvedValue({ jobId: "j_check_2" });
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(applyWorld).not.toHaveBeenCalled();
  });
  it("holds a world fitted to the realm's map when the map moves under the same preview", async () => {
    // the preview object is the one that was checked, and it is not stale: only the map's version says it moved
    const { political: _political, ...layers } = DRAFT.layers;
    const fitted = worldResult({ seed: 7, layers, slots: [] });
    const view = renderRegion({ source: "realm-map", result: fitted, mapVersion: CHECKED_MAP });
    await reachReview(dryRun({ source: "realm-map" }));
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeEnabled();
    view.update({ mapVersion: CHECKED_MAP + 1 });
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
    expect(screen.getByText(/The realm's map changed after this check/)).toBeInTheDocument();
  });
  it("turns Apply off if claims lock the realm while the review is open", async () => {
    const view = renderRegion();
    await reachReview();
    view.update({ lock: claimsLock() });
    const apply = screen.getByRole("button", { name: "Apply this world" });
    expect(apply).toBeDisabled();
    expect(screen.getByText("Claims on this realm's nations lock its world.")).toBeInTheDocument();
    fireEvent.click(apply);
    expect(applyWorld).not.toHaveBeenCalled();
  });

  it.each([
    ["a slider is mid-drag on the same draft", { stale: true }],
    ["the preview is being made again", { generating: true }],
  ])(
    "offers no Apply while %s: the checked world is not what the controls ask for",
    async (_name, change) => {
      const view = renderRegion();
      await reachReview();
      view.update(change);
      expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
      expect(screen.getByText(/The preview changed after this check/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Check again" })).toBeDisabled();
      expect(applyWorld).not.toHaveBeenCalled();
    }
  );
});

describe("when applying is off", () => {
  const reason = (name: string) => screen.getByText(name);

  it.each([
    ["no preview yet", { result: null }, "Make a preview first."],
    ["a preview being made", { generating: true }, "Wait for the preview to finish."],
    [
      "a preview that does not match the controls",
      { stale: true },
      "The preview no longer matches the controls or the realm's map.",
    ],
    ["claims still being read", { lock: { phase: "loading" } }, "Checking the realm's claims."],
    [
      "claims that lock the realm",
      { lock: claimsLock() },
      "Claims on this realm's nations lock its world.",
    ],
    [
      "an archived realm",
      { lock: { phase: "ready", status: { ...STATUS, locked: true, lockReason: "archived" } } },
      "This realm is archived.",
    ],
  ] as const)("disables Use this world for %s, and says why", async (_name, props, text) => {
    renderRegion(props as Partial<WorldApplyRegionProps>);
    expect(getUseButton()).toBeDisabled();
    expect(reason(text)).toBeInTheDocument();
    fireEvent.click(getUseButton());
    expect(global.fetch).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("is not open on a failed claims read, and offers to read them again", () => {
    const retry = jest.fn();
    renderRegion({ lock: { phase: "failed", message: "offline", retry } });
    expect(getUseButton()).toBeDisabled();
    expect(reason("Claims could not be checked, so using a world is off.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check claims again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
