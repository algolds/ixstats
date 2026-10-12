/**
 * Using a generated world (the apply region of the World tab): Use this world uploads the draft and queues the check,
 * the dry run's diff is shown, Apply writes it, and the draft goes when the world is on the map. Applying is off with a
 * reason while the draft is out of date or the claims lock the realm or cannot be read. The server's refusals read in
 * plain words, with Retry and the draft kept. A failed relief step offers Rebuild relief, also after a reload.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

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
import type { WorldLock } from "~/components/maps/editor/panels/WorldApplyRegion";
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
  OPEN,
  REALM,
  STATUS,
  UPLOAD,
  applied,
  claimsLock,
  dryRun,
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

  it("builds the bundle from the draft and sends it to the realm's upload, then queues a world check of it", async () => {
    renderRegion({ source: "preset" });
    await startCheck();
    const bundle = jest.mocked(encodeWorldBundle).mock.calls[0]![0];
    expect(bundle).toMatchObject({ version: 1, seed: 7, source: "preset" });
    expect(Object.keys(bundle.layers).sort()).toEqual(
      ["altitudes", "background", "climate", "icecaps", "lakes", "political", "rivers"].sort()
    );
    const [url, init] = jest.mocked(global.fetch).mock.calls[0]!;
    expect(String(url)).toContain(`/api/admin/map-import/upload?realm=${REALM}`);
    const file = (init!.body as FormData).get("file") as File;
    expect(file.name).toBe("world.json.gz");
    expect(start).toHaveBeenCalledWith({
      realmId: REALM,
      uploadId: UPLOAD.uploadId,
      kind: "world",
      filename: "world-7.json.gz",
    });
  });

  it("sends a world fitted to the realm's map without borders or nations", async () => {
    const { political: _political, ...layers } = DRAFT.layers;
    renderRegion({ source: "realm-map", result: worldResult({ layers, slots: [] }) });
    await startCheck();
    const bundle = jest.mocked(encodeWorldBundle).mock.calls[0]![0];
    expect(bundle).toMatchObject({ source: "realm-map", slots: [] });
    expect(bundle.layers).not.toHaveProperty("political");
  });

  it("shows progress while the check runs, from the job", async () => {
    renderRegion();
    await startCheck();
    act(() =>
      setJob("j_check", { status: "running", progress: 30, stage: "Checking the borders" })
    );
    expect(screen.getByText(/Checking the borders/)).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    act(() => setJob("j_check", { status: "queued", progress: 0, stage: null }));
    expect(screen.getByText(/Waiting for the import runner/)).toBeInTheDocument();
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

  it("says one shape and one nation in the singular", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    const done = applied();
    act(() =>
      setJob("j_apply", {
        ...done,
        result: {
          ...done.result,
          written: 1,
          rejected: [{ layerType: "lakes", key: "l1", reason: "Too small" }],
          slots: { created: 1, retired: 1, opened: 1 },
        },
      })
    );
    await screen.findByText("The world is applied");
    expect(
      screen.getByText("1 map feature written, 1 nation created, 1 nation retired.")
    ).toBeInTheDocument();
    expect(screen.getByText("1 shape could not be written and was left out.")).toBeInTheDocument();
    expect(screen.getByText("1 nation is open for claims.")).toBeInTheDocument();
  });

  it("closes the result", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() => setJob("j_apply", applied()));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(getUseButton()).toBeInTheDocument();
  });
});

describe("the review", () => {
  it("lists what each layer and the nations would gain, change and lose", async () => {
    renderRegion();
    await reachReview();
    const diff = screen.getByLabelText("What using this world changes");
    expect(within(diff).getByText("Elevation").nextSibling).toHaveTextContent(
      "4 new, 2 changed, 1 retired"
    );
    expect(within(diff).getByText("Borders").nextSibling).toHaveTextContent("12 new, 3 retired");
    expect(within(diff).getByText("Lakes").nextSibling).toHaveTextContent("No change");
    expect(within(diff).getByText("Nations").nextSibling).toHaveTextContent(
      "12 new, 3 retired, 2 kept, 1 renamed"
    );
  });

  it("says first what the server flags as replacing work, and lists the other notes quietly", async () => {
    const handEdits =
      "14 features were edited by hand since the last generation and will be replaced";
    const lostBorders =
      "2 nations that are not generated slots, or that a player holds, keep their country but lose their border";
    const taken = "1 names were already taken in this realm and got a number";
    renderRegion();
    await reachReview(
      dryRun({ warnings: [handEdits, lostBorders, taken], replaces: [handEdits, lostBorders] })
    );
    const warning = screen
      .getByText("This replaces work in the realm")
      .closest("div")!.parentElement!;
    expect(warning).toHaveTextContent("14 features were edited by hand");
    expect(warning).toHaveTextContent("lose their border");
    expect(warning).not.toHaveTextContent("already taken");
    expect(screen.getByText(taken)).toBeInTheDocument();
  });

  it("goes by the server's flag and not by the wording of a warning", async () => {
    renderRegion();
    await reachReview(
      dryRun({
        warnings: ["The realm's current map (5 features) will be replaced", "A quiet note"],
        replaces: ["A quiet note"],
      })
    );
    const warning = screen
      .getByText("This replaces work in the realm")
      .closest("div")!.parentElement!;
    expect(warning).toHaveTextContent("A quiet note");
    expect(warning).not.toHaveTextContent("current map");
  });

  it("has no replaced-work warning when the server has none", async () => {
    renderRegion();
    await reachReview();
    expect(screen.queryByText("This replaces work in the realm")).toBeNull();
  });

  it("leaves out the borders row for a world fitted to the realm's own borders", async () => {
    renderRegion();
    await reachReview(dryRun({ source: "realm-map" }));
    expect(
      within(screen.getByLabelText("What using this world changes")).queryByText("Borders")
    ).toBeNull();
  });

  it("goes back to Use this world on Cancel, without applying", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(getUseButton()).toBeInTheDocument();
    expect(applyWorld).not.toHaveBeenCalled();
  });

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

  it("will not check the changed preview while it is still being made", async () => {
    const view = renderRegion();
    await reachReview();
    view.update({ result: worldResult({ seed: 8 }), generating: true });
    expect(screen.getByRole("button", { name: "Check again" })).toBeDisabled();
    expect(screen.getByText("Wait for the preview to finish.")).toBeInTheDocument();
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

  it("offers Apply again when the draft is current again", async () => {
    const view = renderRegion();
    await reachReview();
    view.update({ stale: true });
    view.update({ stale: false });
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeEnabled();
  });
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

  it("offers to read the claims again in every step, not only before a check", async () => {
    const retry = jest.fn();
    const failed: WorldLock = { phase: "failed", message: "offline", retry };
    const view = renderRegion();
    await reachReview();
    view.update({ lock: failed });
    expect(screen.getByRole("button", { name: "Apply this world" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check claims again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    view.update({ lock: OPEN });
    expect(screen.queryByRole("button", { name: "Check claims again" })).toBeNull();

    respondToUpload({ status: 500, body: {} });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(getUseButton());
    await screen.findByText("The world could not be sent.");
    view.update({ lock: failed });
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Check claims again" })).toBeInTheDocument();
  });

  it("is on when the draft is current and the realm is open", () => {
    renderRegion();
    expect(getUseButton()).toBeEnabled();
  });
});

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
