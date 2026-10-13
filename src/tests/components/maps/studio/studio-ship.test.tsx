/**
 * The Ship tab: GeoJSON as one zip and the PNG at three widths (with the failure said inline), applying to a realm
 * (the founder's flow for a preset world; Ixnay only from the fit source with a ticked layer, sent to `start` as
 * `options.layers`; the lock from `atlas.studio.applyStatus`), and a new realm made from the world.
 */
import { TextDecoder, TextEncoder } from "util";
import { keepPreviousData } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => jest.requireActual("~/tests/helpers/fake-studio-trpc"));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);
// jsdom has no CompressionStream; the bytes only need to exist
jest.mock("~/lib/maps/import/world-bundle", () => ({
  ...jest.requireActual("~/lib/maps/import/world-bundle"),
  encodeWorldBundle: jest.fn(),
}));

import { StudioShipTab } from "~/components/maps/studio/StudioShipTab";
import { start } from "~/tests/helpers/fake-map-import";
import {
  applyStatusQuery,
  createRealm,
  invalidate,
  resetStudioTrpc,
} from "~/tests/helpers/fake-studio-trpc";
import { renderTab, studioValue } from "~/tests/helpers/studio-tab-fixtures";
import {
  STATUS,
  dryRun,
  refusal,
  resetWorldApplyTests,
} from "~/tests/helpers/world-apply-fixtures";
import { setJob } from "~/tests/helpers/fake-map-import";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import type { StudioContextValue } from "~/components/maps/studio/StudioContext";

// jsdom has neither; the browser does
Object.assign(globalThis, { TextEncoder, TextDecoder });

const created: Blob[] = [];
const revoked: string[] = [];
const downloads: Array<{ href: string; download: string }> = [];

beforeEach(() => {
  resetStudioTrpc();
  resetWorldApplyTests();
  created.length = 0;
  revoked.length = 0;
  downloads.length = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      created.push(blob);
      return `blob:file-${created.length}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: (url: string) => revoked.push(url),
  });
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push({ href: this.href, download: this.download });
  });
  applyStatusQuery.mockReturnValue({ data: STATUS, isError: false });
});
afterEach(() => jest.restoreAllMocks());

/** The names in a zip's central directory, and how many entries it says it has. */
async function zipNames(blob: Blob): Promise<string[]> {
  const bytes = await new Promise<Uint8Array>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const names: string[] = [];
  let at = view.getUint32(end + 16, true);
  for (let i = 0; i < view.getUint16(end + 10, true); i++) {
    const length = view.getUint16(at + 28, true);
    names.push(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + length)));
    at += 46 + length + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return names;
}

const fitted = (realm: string): Partial<StudioContextValue> => ({
  source: { kind: "fit", preset: "earthlike", realm },
  fit: {
    state: "ready",
    landMaskLayers: {},
    mapVersion: 5,
    maskKey: `${realm}:5`,
    retry: jest.fn(),
  },
});

const pickRealm = (slug: string) =>
  fireEvent.change(screen.getByRole("combobox", { name: "Realm to apply to" }), {
    target: { value: slug },
  });

describe("Studio Ship tab: export", () => {
  it("downloads one zip with a file for each layer, named for the preset and the seed", async () => {
    const value = studioValue({
      generator: { ...studioValue().generator, result: worldResult({ seed: 99 }) },
    });
    renderTab(<StudioShipTab />, value);
    fireEvent.click(screen.getByRole("button", { name: /Download GeoJSON/ }));
    expect(downloads).toEqual([{ href: "blob:file-1", download: "world-earthlike-99.zip" }]);
    expect((await zipNames(created[0]!)).sort()).toEqual(
      Object.keys(value.generator.result!.layers)
        .map((layer) => `${layer}.geojson`)
        .sort()
    );
  });

  it("draws the PNG at the width and politics chosen, downloads it, and revokes the URL after", async () => {
    const value = studioValue();
    const png = new Blob(["png"], { type: "image/png" });
    jest.mocked(value.generator.renderPng).mockResolvedValue(png);
    renderTab(<StudioShipTab />, value);

    fireEvent.click(screen.getByRole("radio", { name: "8192 px" }));
    fireEvent.click(screen.getByRole("switch", { name: "Political fills and borders" }));
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(value.generator.renderPng).toHaveBeenCalledWith(8192, false);
    expect(created).toEqual([png]);
    expect(downloads[0]).toEqual({ href: "blob:file-1", download: "world-earthlike-7-8192.png" });
    await waitFor(() => expect(revoked).toEqual(["blob:file-1"]), { timeout: 3000 });
  });

  it("starts at 4096 with the political fills on", async () => {
    const value = studioValue();
    jest.mocked(value.generator.renderPng).mockResolvedValue(new Blob(["png"]));
    renderTab(<StudioShipTab />, value);
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(value.generator.renderPng).toHaveBeenCalledWith(4096, true);
  });

  it("says inline that the browser could not make an image this large, and downloads nothing", async () => {
    const value = studioValue();
    jest.mocked(value.generator.renderPng).mockRejectedValue(new Error("canvas too large"));
    renderTab(<StudioShipTab />, value);
    fireEvent.click(screen.getByRole("radio", { name: "8192 px" }));
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your browser could not make an image this large. Try 4096."
    );
    expect(created).toHaveLength(0);
    // The button is back for another try
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled();
  });

  it("says the world changed when the render was outrun, not that the image is too large", async () => {
    const value = studioValue();
    jest
      .mocked(value.generator.renderPng)
      .mockRejectedValue(new Error("The world changed before the answer came"));
    renderTab(<StudioShipTab />, value);
    fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The world changed while the image");
  });

  it("exports nothing without a world", () => {
    const base = studioValue();
    renderTab(
      <StudioShipTab />,
      studioValue({ generator: { ...base.generator, result: null, state: "idle" } })
    );
    expect(screen.getByRole("button", { name: /Download GeoJSON/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
  });
});

describe("Studio Ship tab: apply to a realm", () => {
  it("sends a preset world to a realm through the founder's flow, with no layer choice", async () => {
    renderTab(<StudioShipTab />);
    expect(screen.queryByText("Layers to write")).toBeNull();
    pickRealm("eurth");
    expect(applyStatusQuery).toHaveBeenLastCalledWith(
      { realm: "r_eurth", layers: false },
      expect.anything()
    );
    fireEvent.click(await screen.findByRole("button", { name: "Use this world" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start.mock.calls[0]![0]).toMatchObject({ realmId: "r_eurth", kind: "world" });
    expect(start.mock.calls[0]![0]).not.toHaveProperty("options");
  });

  it("will not send a preset world to Ixnay, and says what to do", () => {
    renderTab(<StudioShipTab />);
    pickRealm("ixnay");
    expect(
      screen.getByText(/Set the source to Fit to a realm's map and choose Ixnay/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();
    expect(applyStatusQuery).not.toHaveBeenCalled();
  });

  it("will not send a world to Ixnay without a ticked layer, and sends the ticked ones to start", async () => {
    renderTab(<StudioShipTab />, studioValue(fitted("ixnay")));
    expect(screen.getByText("Tick at least one layer to write to Ixnay.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();
    expect(screen.getByText(/replace Ixnay's current layers of that kind/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Rivers" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Elevation" }));
    expect(applyStatusQuery).toHaveBeenLastCalledWith(
      { realm: "r_ixnay", layers: true },
      expect.anything()
    );
    fireEvent.click(await screen.findByRole("button", { name: "Use this world" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        realmId: "r_ixnay",
        kind: "world",
        fittedMapVersion: 5,
        options: { layers: ["altitudes", "rivers"] },
      })
    );

    // Unticking the last layer takes the way on away again
    act(() => setJob("j_check", { ...dryRun({ source: "realm-map" }), realmId: "r_ixnay" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Rivers" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Elevation" }));
    expect(screen.getByText("Tick at least one layer to write to Ixnay.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
  });

  it("offers the layer choice for any realm with the fit source, and sends no choice with none ticked", async () => {
    renderTab(<StudioShipTab />, studioValue(fitted("eurth")));
    expect(screen.getByText(/can only go to Eurth/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Realm to apply to" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Ice" })).toBeInTheDocument();
    // What none ticked means: only what the realm lacks is added, and what it has is kept
    expect(
      screen.getByText(/With none ticked, only layers the realm does not have yet are added/)
    ).toBeInTheDocument();
    expect(screen.getByText(/replace the realm's current layers of that kind/)).toBeInTheDocument();
    expect(screen.getByText(/Land, borders and nations are never written/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Use this world" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start.mock.calls[0]![0]).toMatchObject({ realmId: "r_eurth", fittedMapVersion: 5 });
    expect(start.mock.calls[0]![0]).not.toHaveProperty("options");
  });

  it("disables a layer the rail has switched off, with the reason, and never sends it", async () => {
    const base = studioValue(fitted("ixnay"));
    const value = studioValue({
      ...fitted("ixnay"),
      params: { ...base.params, hasIcecaps: false, hasLakes: false },
    });
    renderTab(<StudioShipTab />, value);
    for (const name of ["Ice", "Lakes"]) {
      const box = screen.getByRole("checkbox", { name });
      expect(box).toBeDisabled();
      expect(box).toHaveAccessibleDescription(/Switched off in the rail/);
    }
    expect(screen.getByRole("checkbox", { name: "Rivers" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ice" }));
    expect(screen.getByText("Tick at least one layer to write to Ixnay.")).toBeInTheDocument();
  });

  it("drops a ticked layer from the choice once the rail switches it off", async () => {
    const base = studioValue(fitted("eurth"));
    const { rerenderWith } = renderTab(<StudioShipTab />, base);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ice" }));
    expect(screen.getByRole("checkbox", { name: "Ice" })).toBeChecked();
    rerenderWith({ ...base, params: { ...base.params, hasIcecaps: false } });
    expect(screen.getByRole("checkbox", { name: "Ice" })).not.toBeChecked();
    expect(applyStatusQuery).toHaveBeenLastCalledWith(
      { realm: "r_eurth", layers: false },
      expect.anything()
    );
  });

  it("asks the lock of a layer choice without claims, and of a plain apply with them", async () => {
    applyStatusQuery.mockImplementation((input: { layers: boolean }) => ({
      data: input.layers
        ? STATUS
        : { ...STATUS, locked: true, lockReason: "claims", pendingClaims: 2 },
      isError: false,
    }));
    renderTab(<StudioShipTab />, studioValue(fitted("eurth")));
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeDisabled();
    expect(screen.getByText("Claims on this realm's nations lock its world.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Lakes" }));
    expect(await screen.findByRole("button", { name: "Use this world" })).toBeEnabled();
  });

  it("keeps the last status while the lock is asked again for a changed layer choice", () => {
    renderTab(<StudioShipTab />, studioValue(fitted("eurth")));
    const options = applyStatusQuery.mock.calls.at(-1)![1] as { placeholderData: unknown };
    expect(options.placeholderData).toBe(keepPreviousData);
  });

  it("holds the apply while the lock cannot be read, and offers to ask again", async () => {
    const refetch = jest.fn();
    applyStatusQuery.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("down"),
      refetch,
    });
    renderTab(<StudioShipTab />);
    pickRealm("eurth");
    expect(screen.getByRole("button", { name: "Use this world" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check claims again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("holds the apply while the world is out of date", () => {
    renderTab(<StudioShipTab />, studioValue({ stale: true }));
    pickRealm("eurth");
    expect(screen.getByRole("button", { name: "Use this world" })).toBeDisabled();
    expect(screen.getByText(/no longer matches/)).toBeInTheDocument();
  });

  it("refreshes the realm's status and the realm list once the world is applied", async () => {
    renderTab(<StudioShipTab />);
    pickRealm("eurth");
    fireEvent.click(await screen.findByRole("button", { name: "Use this world" }));
    await screen.findByText(/Checking the world/);
    act(() => setJob("j_check", dryRun()));
    fireEvent.click(await screen.findByRole("button", { name: "Apply this world" }));
    await screen.findByText(/Applying the world/);
    act(() =>
      setJob("j_apply", {
        status: "succeeded",
        progress: 100,
        stage: null,
        error: null,
        result: {
          phase: "world-apply",
          written: 3,
          rejected: [],
          deactivated: 0,
          slots: { created: 0, retired: 0, opened: 0 },
          mapImportId: "i",
          rollbackAvailable: true,
          relief: { status: "built", version: "v", tiles: 1, error: null },
        },
      })
    );
    await screen.findByText("The world is applied");
    expect(invalidate.applyStatus).toHaveBeenCalled();
    expect(invalidate.overview).toHaveBeenCalled();
  });
});

describe("Studio Ship tab: new realm from this world", () => {
  const fill = (name: string) =>
    fireEvent.change(screen.getByLabelText("Realm name"), { target: { value: name } });

  it("makes the realm from a name and a slug it suggests, then applies the world to it", async () => {
    createRealm.mockResolvedValue({ realmId: "r_new", slug: "dry-world" });
    renderTab(<StudioShipTab />);
    fill("Dry World");
    expect(screen.getByLabelText("Web address")).toHaveValue("dry-world");
    fireEvent.click(screen.getByRole("button", { name: "Create the realm" }));

    const section = await screen.findByRole("region", { name: "New realm from this world" });
    await within(section).findByText("Dry World is created");
    expect(createRealm).toHaveBeenCalledWith({ name: "Dry World", slug: "dry-world" });
    expect(invalidate.overview).toHaveBeenCalled();
    expect(within(section).getByRole("link", { name: "Open Dry World in Atlas" })).toHaveAttribute(
      "href",
      "/admin/maps/realms/dry-world"
    );

    // The same flow, on the new realm
    expect(applyStatusQuery).toHaveBeenLastCalledWith(
      { realm: "r_new", layers: false },
      expect.anything()
    );
    fireEvent.click(await within(section).findByRole("button", { name: "Use this world" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start.mock.calls[0]![0]).toMatchObject({ realmId: "r_new", kind: "world" });
    expect(start.mock.calls[0]![0]).not.toHaveProperty("options");
  });

  it("keeps the draft realm and its Atlas link when the apply fails", async () => {
    createRealm.mockResolvedValue({ realmId: "r_new", slug: "dry-world" });
    start.mockRejectedValue(refusal("The world is not valid", "BAD_REQUEST"));
    renderTab(<StudioShipTab />);
    fill("Dry World");
    fireEvent.click(screen.getByRole("button", { name: "Create the realm" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use this world" }));
    expect(await screen.findByText(/The world is not valid/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Dry World in Atlas" })).toBeInTheDocument();
    expect(screen.getByText(/the realm stays as it is/)).toBeInTheDocument();
  });

  it("says why the realm was not made, and offers no apply", async () => {
    createRealm.mockRejectedValue(new Error("That slug is taken"));
    renderTab(<StudioShipTab />);
    fill("Eurth");
    fireEvent.click(screen.getByRole("button", { name: "Create the realm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That slug is taken");
    expect(screen.queryByText(/is created/)).toBeNull();
  });

  it("needs a name and a slug the server will take", () => {
    renderTab(<StudioShipTab />);
    const create = screen.getByRole("button", { name: "Create the realm" });
    expect(create).toBeDisabled();
    fill("Dry World");
    expect(create).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Web address"), { target: { value: "Dry World" } });
    expect(create).toBeDisabled();
    expect(screen.getByText(/lower-case letters, digits or hyphens/)).toBeInTheDocument();
  });

  it("is for a preset world only", () => {
    renderTab(<StudioShipTab />, studioValue(fitted("eurth")));
    expect(screen.queryByLabelText("Realm name")).toBeNull();
    expect(screen.getByText(/Set the source to a preset to make a new realm/)).toBeInTheDocument();
    expect(createRealm).not.toHaveBeenCalled();
  });
});
