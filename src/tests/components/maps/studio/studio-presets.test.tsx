/**
 * The Presets tab: every action calls its procedure, never with a seed; publishing, restoring over a draft, resetting
 * to factory and archiving ask first; built-ins cannot be archived; what a restore or a reset writes goes into the
 * rail; and nothing is written while the presets are the built-ins from code.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => jest.requireActual("~/tests/helpers/fake-studio-trpc"));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { StudioPresetsTab } from "~/components/maps/studio/StudioPresetsTab";
import { paramsForPreset, type StudioParams } from "~/lib/worldgen/studio-fields";
import { FACTORY_STUDIO_PRESETS, type StudioPreset } from "~/lib/worldgen/studio-presets";
import {
  invalidate,
  presetWrites,
  resetStudioTrpc,
  versionsQuery,
} from "~/tests/helpers/fake-studio-trpc";
import { renderTab, studioValue } from "~/tests/helpers/studio-tab-fixtures";

const BADLANDS: StudioPreset = {
  slug: "badlands",
  name: "Badlands",
  builtIn: false,
  hasDraft: true,
  published: true,
  params: { terrainRoughness: 0.9 },
};
const PRESETS = [...FACTORY_STUDIO_PRESETS, BADLANDS];

/** The rail holds the preset's own values plus a seed that must never be sent. */
const railParams = (): StudioParams =>
  ({ ...paramsForPreset({ terrainRoughness: 0.9 }), seed: 4242 }) as StudioParams;

const withPreset = (slug: string, over: Parameters<typeof studioValue>[0] = {}) => {
  const preset = PRESETS.find((p) => p.slug === slug)!;
  return studioValue({
    presets: PRESETS,
    presetSlug: slug,
    presetParams: paramsForPreset(preset.params),
    params: railParams(),
    ...over,
  });
};

const summary = (over: object = {}) => ({
  slug: "badlands",
  name: "Badlands",
  description: "",
  builtIn: false,
  sortOrder: 3,
  published: null,
  draft: null,
  archived: false,
  ...over,
});

const confirm = (name: string) =>
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name }));

/** The params of the one call a write made: it has no seed and no key the server would refuse. */
function sentParams(write: jest.Mock): Record<string, unknown> {
  expect(write).toHaveBeenCalledTimes(1);
  const { params } = write.mock.calls[0]![0] as { params: Record<string, unknown> };
  expect("seed" in params).toBe(false);
  return params;
}

beforeEach(() => {
  resetStudioTrpc();
  for (const write of Object.values(presetWrites)) write.mockResolvedValue(summary());
});

describe("Studio Presets tab", () => {
  it("lists the presets with their state, and choosing one loads it into the rail", () => {
    const value = withPreset("badlands");
    renderTab(<StudioPresetsTab />, value);
    const list = screen.getByRole("list", { name: "Presets" });
    const row = within(list).getByRole("button", { name: /^Badlands/ });
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveTextContent("Published");
    expect(row).toHaveTextContent("Draft");
    expect(within(list).getByRole("button", { name: /^Eurth/ })).toHaveTextContent("Published");

    fireEvent.click(within(list).getByRole("button", { name: /^Ixnay/ }));
    expect(value.pickPreset).toHaveBeenCalledWith("ixnay");
  });

  it("saves the rail to the selected preset as its draft, without the seed", async () => {
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
    expect(presetWrites.saveDraft.mock.calls[0]![0]).toMatchObject({ slug: "badlands" });
    expect(sentParams(presetWrites.saveDraft).terrainRoughness).toBe(0.9);
    expect(invalidate.presetsList).toHaveBeenCalled();
  });

  it("saves the rail as a new preset by name, without the seed, and loads it once it is listed", async () => {
    presetWrites.create.mockResolvedValue(summary({ slug: "dry-world", name: "Dry world" }));
    const value = withPreset("badlands");
    const view = renderTab(<StudioPresetsTab />, value);
    fireEvent.change(screen.getByLabelText("Save the rail as a new preset"), {
      target: { value: "  Dry world " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new" }));
    await screen.findByText("Saved Dry world as a new preset.");
    expect(presetWrites.create.mock.calls[0]![0]).toMatchObject({ name: "Dry world" });
    sentParams(presetWrites.create);

    // Not yet in the list: nothing is picked
    expect(value.pickPreset).not.toHaveBeenCalled();
    view.rerenderWith({
      ...value,
      presets: [
        ...PRESETS,
        { ...BADLANDS, slug: "dry-world", name: "Dry world", published: false },
      ],
    });
    await waitFor(() => expect(value.pickPreset).toHaveBeenCalledWith("dry-world"));
  });

  it("loads a new preset whether the list or the write's answer arrives first", async () => {
    let resolve!: (value: object) => void;
    presetWrites.create.mockReturnValue(new Promise((r) => (resolve = r)));
    const value = withPreset("badlands");
    const view = renderTab(<StudioPresetsTab />, value);
    fireEvent.change(screen.getByLabelText("Save the rail as a new preset"), {
      target: { value: "Dry world" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new" }));

    // The refetched list is in before the write has answered
    view.rerenderWith({
      ...value,
      presets: [...PRESETS, { ...BADLANDS, slug: "dry-world", name: "Dry world" }],
    });
    expect(value.pickPreset).not.toHaveBeenCalled();
    await act(async () => resolve(summary({ slug: "dry-world", name: "Dry world" })));
    await waitFor(() => expect(value.pickPreset).toHaveBeenCalledWith("dry-world"));
    expect(value.pickPreset).toHaveBeenCalledTimes(1);
  });

  it("makes the confirm button of archive and reset destructive, and publish not", () => {
    const open = (name: string) => {
      fireEvent.click(screen.getByRole("button", { name }));
      return within(screen.getByRole("alertdialog")).getAllByRole("button").at(-1)!;
    };
    const { unmount } = renderTab(<StudioPresetsTab />, withPreset("badlands"));
    expect(open("Archive").className).toContain("bg-destructive");
    unmount();
    renderTab(<StudioPresetsTab />, withPreset("eurth"));
    expect(open("Reset to factory").className).toContain("bg-destructive");
  });

  it("asks before publishing, and publishes the saved draft", async () => {
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(presetWrites.publish).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Founders see the saved draft");
    confirm("Publish");
    await screen.findByText("Published.");
    expect(presetWrites.publish).toHaveBeenCalledWith({ slug: "badlands" });
  });

  it("does not offer to publish a preset that has no draft", () => {
    renderTab(<StudioPresetsTab />, withPreset("eurth"));
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("names the rail changes the preset does not hold", () => {
    renderTab(<StudioPresetsTab />, withPreset("badlands", { params: paramsForPreset({}) }));
    expect(screen.getByRole("status")).toHaveTextContent("The rail has changes");
  });

  it("restores a version into a new draft and loads it into the rail", async () => {
    versionsQuery.mockReturnValue({
      data: [
        {
          versionId: "v9",
          params: {},
          note: "Tuned",
          createdBy: "u",
          publishedAt: new Date(0),
          current: true,
        },
        {
          versionId: "v5",
          params: {},
          note: null,
          createdBy: "u",
          publishedAt: new Date(1e9),
          current: false,
        },
      ],
      isError: false,
    });
    presetWrites.restore.mockResolvedValue(
      summary({
        draft: { versionId: "d1", params: { terrainRoughness: 0.2 }, savedAt: new Date() },
      })
    );
    const value = withPreset("eurth");
    renderTab(<StudioPresetsTab />, value);
    const versions = screen.getByRole("region", { name: "Versions" });
    expect(within(versions).getByText("Current")).toBeInTheDocument();
    expect(within(versions).getByText("Tuned")).toBeInTheDocument();

    // Eurth has no draft, so there is nothing to replace and no question
    fireEvent.click(within(versions).getAllByRole("button", { name: "Restore" })[1]!);
    await screen.findByText("Draft restored from that version.");
    expect(presetWrites.restore).toHaveBeenCalledWith({ slug: "eurth", versionId: "v5" });
    expect(value.setParams).toHaveBeenCalledWith(
      expect.objectContaining({ terrainRoughness: 0.2, plateCount: paramsForPreset({}).plateCount })
    );
  });

  it("asks before a restore replaces a saved draft", async () => {
    versionsQuery.mockReturnValue({
      data: [
        {
          versionId: "v5",
          params: {},
          note: null,
          createdBy: "u",
          publishedAt: new Date(0),
          current: true,
        },
      ],
      isError: false,
    });
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Versions" })).getByRole("button", {
        name: "Restore",
      })
    );
    expect(presetWrites.restore).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("replaces the draft now saved");
    confirm("Restore");
    await waitFor(() =>
      expect(presetWrites.restore).toHaveBeenCalledWith({ slug: "badlands", versionId: "v5" })
    );
  });

  it("resets a built-in to factory after asking, and puts the draft in the rail", async () => {
    presetWrites.resetToFactory.mockResolvedValue(
      summary({
        slug: "eurth",
        builtIn: true,
        draft: { versionId: "d2", params: { oceanPercentage: 0.6 }, savedAt: new Date() },
      })
    );
    const value = withPreset("eurth");
    renderTab(<StudioPresetsTab />, value);
    fireEvent.click(screen.getByRole("button", { name: "Reset to factory" }));
    expect(presetWrites.resetToFactory).not.toHaveBeenCalled();
    confirm("Reset to factory");
    await screen.findByText("Draft reset to the factory values.");
    expect(presetWrites.resetToFactory).toHaveBeenCalledWith({ slug: "eurth" });
    expect(value.setParams).toHaveBeenCalledWith(expect.objectContaining({ oceanPercentage: 0.6 }));
  });

  it("offers reset to factory to built-ins only, and archive to the others only", () => {
    const { unmount } = renderTab(<StudioPresetsTab />, withPreset("eurth"));
    expect(screen.getByRole("button", { name: "Reset to factory" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    unmount();
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    expect(screen.queryByRole("button", { name: "Reset to factory" })).toBeNull();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("archives after asking, and falls back to Earth-like", async () => {
    const value = withPreset("badlands");
    renderTab(<StudioPresetsTab />, value);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(presetWrites.archive).not.toHaveBeenCalled();
    confirm("Archive");
    await screen.findByText("Archived.");
    expect(presetWrites.archive).toHaveBeenCalledWith({ slug: "badlands" });
    expect(value.pickPreset).toHaveBeenCalledWith("earthlike");
  });

  it("renames the selected preset", async () => {
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Dry lands" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await screen.findByText("Renamed.");
    expect(presetWrites.rename).toHaveBeenCalledWith({ slug: "badlands", name: "Dry lands" });
  });

  it("reorders with the arrows, sending every slug in the new order", async () => {
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    expect(screen.getByRole("button", { name: "Move Earth-like up" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move Earth-like down" }));
    await screen.findByText("Order saved.");
    expect(presetWrites.reorder).toHaveBeenCalledWith({
      slugs: ["ixnay", "earthlike", "eurth", "badlands"],
    });
  });

  it("shows the server's reason when a write fails, and says nothing happened", async () => {
    presetWrites.publish.mockRejectedValue(new Error("That preset has no draft to publish"));
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    confirm("Publish");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That preset has no draft to publish"
    );
    expect(screen.queryByText("Published.")).toBeNull();
    expect(invalidate.presetsList).not.toHaveBeenCalled();
  });

  it("writes nothing while the presets are the built-ins from code", () => {
    renderTab(<StudioPresetsTab />, withPreset("eurth", { presetsFallback: true }));
    expect(screen.getByRole("alert")).toHaveTextContent("nothing can be saved");
    for (const name of ["Save draft", "Publish", "Reset to factory", "Rename", "Save as new"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Move Earth-like down" })).toBeDisabled();
  });
});
