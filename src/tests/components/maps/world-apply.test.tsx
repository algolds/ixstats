/**
 * Using a generated world (the apply region of the World tab): Use this world uploads the draft and queues the check,
 * the dry run's diff is shown, Apply writes it, and the draft goes when the world is on the map. Applying is off with a
 * reason while the draft is out of date or the claims lock the realm or cannot be read. The server's refusals read in
 * plain words, with Retry and the draft kept. A failed relief step offers Rebuild relief, also after a reload.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
import {
  WorldApplyRegion,
  type WorldApplyRegionProps,
  type WorldLock,
} from "~/components/maps/editor/panels/WorldApplyRegion";
import {
  applyWorld,
  calls,
  failRead,
  invalidated,
  rebuildRelief,
  resetFakeMapImport,
  setJob,
  start,
} from "~/tests/helpers/fake-map-import";
import { layerJson, worldResult } from "~/tests/helpers/fake-world-worker";

const REALM = "r_eurth";
const DRAFT = worldResult({ seed: 7 });

const STATUS = {
  realmId: REALM,
  status: "active",
  pendingClaims: 0,
  approvedClaims: 0,
  locked: false,
  lockReason: null,
  canReviewClaims: true,
  reliefFailed: false,
} as const;
const OPEN: WorldLock = { phase: "ready", status: STATUS };
const claimsLock = (): WorldLock => ({
  phase: "ready",
  status: { ...STATUS, locked: true, lockReason: "claims", pendingClaims: 2 },
});

/** What tRPC raises for a refusal: an Error that carries the server's code. */
const refusal = (message: string, code: string) =>
  Object.assign(new Error(message), { data: { code } });

const UPLOAD = { uploadId: "a".repeat(64), kind: "world", filename: "world.json.gz", size: 9 };

const counts = (create = 0, change = 0, retire = 0) => ({ create, change, retire });
const dryRun = (over: Record<string, unknown> = {}) => ({
  status: "succeeded",
  progress: 100,
  stage: null,
  error: null,
  result: {
    phase: "world-dry-run",
    source: "preset",
    seed: 7,
    developmentLevel: "industrial",
    layers: {
      background: counts(1),
      altitudes: counts(4, 2, 1),
      climate: counts(6),
      political: counts(12, 0, 3),
      rivers: counts(30, 0, 25),
      lakes: counts(),
      icecaps: counts(2),
    },
    slots: { create: 12, retire: 3, keep: 2, renamed: 1 },
    warnings: [],
    ...over,
  },
});
const applied = (relief: Record<string, unknown> = {}) => ({
  status: "succeeded",
  progress: 100,
  stage: null,
  error: null,
  result: {
    phase: "world-apply",
    written: 140,
    rejected: [],
    deactivated: 20,
    slots: { created: 12, retired: 3, opened: 12 },
    mapImportId: "i_1",
    rollbackAvailable: true,
    relief: { status: "built", version: "abc12345", tiles: 12, error: null, ...relief },
  },
});

function respondToUpload(response: { status: number; body: object } | null = null) {
  global.fetch = jest.fn(async () => {
    calls.push("upload");
    const { status, body } = response ?? { status: 200, body: UPLOAD };
    return { ok: status < 400, status, json: async () => body } as Response;
  });
}

function renderRegion(props: Partial<WorldApplyRegionProps> = {}) {
  const onDiscardDraft = jest.fn();
  const base: WorldApplyRegionProps = {
    realm: { id: REALM, slug: "eurth" },
    result: DRAFT,
    source: "preset",
    generating: false,
    stale: false,
    lock: OPEN,
    onDiscardDraft,
  };
  const view = render(<WorldApplyRegion {...base} {...props} />);
  return {
    onDiscardDraft,
    ...view,
    update: (next: Partial<WorldApplyRegionProps>) =>
      view.rerender(<WorldApplyRegion {...base} {...props} {...next} />),
  };
}

const useButton = () => screen.getByRole("button", { name: "Use this world" });

/** Click Use this world and wait until the check has been queued and is being polled. */
async function startCheck() {
  fireEvent.click(useButton());
  await screen.findByText(/Checking the world/);
}

/** The check finishes with `diff`; the review is up. */
async function reachReview(diff = dryRun()) {
  await startCheck();
  act(() => setJob("j_check", diff));
  await screen.findByText("What this world changes");
}

beforeEach(() => {
  resetFakeMapImport();
  respondToUpload();
  jest.mocked(encodeWorldBundle).mockReset();
  jest.mocked(encodeWorldBundle).mockResolvedValue(new Uint8Array([0x1f, 0x8b, 0x08, 1, 2]));
  start.mockResolvedValue({ jobId: "j_check" });
  applyWorld.mockResolvedValue({ jobId: "j_apply" });
  rebuildRelief.mockResolvedValue({ source: "cells", version: "abc12345", built: true, tiles: 12 });
});
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

  it("closes the result", async () => {
    renderRegion();
    await reachReview();
    fireEvent.click(screen.getByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() => setJob("j_apply", applied()));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(useButton()).toBeInTheDocument();
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

  it("says first that hand edits are replaced, and lists the other notes quietly", async () => {
    renderRegion();
    await reachReview(
      dryRun({
        warnings: [
          "14 features were edited by hand since the last generation and will be replaced",
          "1 names were already taken in this realm and got a number",
        ],
      })
    );
    const warning = screen
      .getByText("This replaces work in the realm")
      .closest("div")!.parentElement!;
    expect(warning).toHaveTextContent("14 features were edited by hand");
    expect(warning).not.toHaveTextContent("already taken");
    expect(screen.getByText(/already taken in this realm/)).toBeInTheDocument();
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
    expect(useButton()).toBeInTheDocument();
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

  it("still applies the world that was checked while a slider is mid-drag on the same draft", async () => {
    const view = renderRegion();
    await reachReview();
    view.update({ stale: true });
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
    expect(useButton()).toBeDisabled();
    expect(reason(text)).toBeInTheDocument();
    fireEvent.click(useButton());
    expect(global.fetch).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("is not open on a failed claims read, and offers to read them again", () => {
    const retry = jest.fn();
    renderRegion({ lock: { phase: "failed", message: "offline", retry } });
    expect(useButton()).toBeDisabled();
    expect(reason("Claims could not be checked, so using a world is off.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("is on when the draft is current and the realm is open", () => {
    renderRegion();
    expect(useButton()).toBeEnabled();
  });
});

describe("a refusal", () => {
  it("says the upload was refused, in the server's words, and keeps the draft", async () => {
    respondToUpload({
      status: 409,
      body: { error: "The world is locked: 2 claims are pending or approved in this realm" },
    });
    const { onDiscardDraft } = renderRegion();
    fireEvent.click(useButton());
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
    fireEvent.click(useButton());
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
    fireEvent.click(useButton());
    expect(await screen.findByText("The world could not be sent.")).toBeInTheDocument();
    expect(screen.getByText("The preview has no rivers layer")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("tries the whole flow again on Retry, from the upload", async () => {
    respondToUpload({ status: 500, body: { error: "Upload failed" } });
    renderRegion();
    fireEvent.click(useButton());
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
    fireEvent.click(useButton());
    await screen.findByText("The world could not be sent.");
    view.update({ lock: claimsLock() });
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });

  it("closes the message and offers Use this world again", async () => {
    respondToUpload({ status: 500, body: {} });
    renderRegion();
    fireEvent.click(useButton());
    await screen.findByText("The world could not be sent.");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(useButton()).toBeInTheDocument();
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
    expect(screen.getByText(/The realm can't take a world right now\./)).toBeInTheDocument();
    expect(invalidated.display).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", REBUILD));
    expect(await screen.findByText("The relief was rebuilt.")).toBeInTheDocument();
    expect(rebuildRelief).toHaveBeenCalledTimes(2);
  });
});
