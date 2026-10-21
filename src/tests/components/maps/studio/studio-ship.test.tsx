/**
 * The Ship tab: GeoJSON as one zip and the PNG at three widths (with the failure said inline), applying to a realm
 * (the founder's flow for a preset world; Ixnay only from the fit source with a ticked layer, sent to `start` as
 * `options.layers`; the lock from `atlas.studio.applyStatus`), and a new realm made from the world.
 */
import { TextDecoder, TextEncoder } from "util";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

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
import { applyStatusQuery, createRealm, resetStudioTrpc } from "~/tests/helpers/fake-studio-trpc";
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
describe("Studio Ship tab: apply to a realm", () => {
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
  /** A context whose rail and whose world in view disagree on the layer switches */
  const withSwitches = (
    realm: string,
    rail: Partial<Record<"hasRivers" | "hasLakes" | "hasIcecaps", boolean>>,
    world: Partial<Record<"hasRivers" | "hasLakes" | "hasIcecaps", boolean>>
  ) => {
    const base = studioValue(fitted(realm));
    return studioValue({
      ...fitted(realm),
      params: { ...base.params, ...rail },
      generator: {
        ...base.generator,
        result: worldResult({ params: { ...base.generator.result!.params, ...world } }),
      },
    });
  };

  it("disables a layer the world in view was made without, with the reason, and never sends it", async () => {
    renderTab(<StudioShipTab />, withSwitches("ixnay", {}, { hasIcecaps: false, hasLakes: false }));
    for (const name of ["Ice", "Lakes"]) {
      const box = screen.getByRole("checkbox", { name });
      expect(box).toBeDisabled();
      expect(box).toHaveAccessibleDescription(/made without it/);
    }
    expect(screen.getByRole("checkbox", { name: "Rivers" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ice" }));
    expect(screen.getByText("Tick at least one layer to write to Ixnay.")).toBeInTheDocument();
  });

  it("follows the world in view, not a rail change that has not made a new world yet", () => {
    // Rail: rivers off, but the world in view has rivers; and the reverse for lakes
    renderTab(
      <StudioShipTab />,
      withSwitches(
        "eurth",
        { hasRivers: false, hasLakes: true },
        { hasRivers: true, hasLakes: false }
      )
    );
    expect(screen.getByRole("checkbox", { name: "Rivers" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Lakes" })).toBeDisabled();
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
});

describe("Studio Ship tab: new realm from this world", () => {
  const fill = (name: string) =>
    fireEvent.change(screen.getByLabelText("Realm name"), { target: { value: name } });
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
});
