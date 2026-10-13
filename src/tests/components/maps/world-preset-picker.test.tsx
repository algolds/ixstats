/**
 * The founder World tab's preset picker (also the elevation-profile control): a segmented control up to three
 * presets, a select beyond, so a fourth published preset is never clipped.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

import { WorldPresetPicker } from "~/components/maps/editor/panels/WorldPresetPicker";
import { useWorldPresets } from "~/components/maps/editor/hooks/useWorldPresets";
import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";

jest.mock("~/components/maps/editor/hooks/useWorldPresets", () => ({ useWorldPresets: jest.fn() }));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

const presetsOf = (count: number): readonly WorldPresetOption[] =>
  Array.from({ length: count }, (_, index) => ({
    ...FACTORY_PRESETS[0]!,
    slug: `preset-${index}`,
    name: `Preset ${index}`,
  }));

function show(count: number, onValueChange = jest.fn()) {
  jest.mocked(useWorldPresets).mockReturnValue({ presets: presetsOf(count), fallback: false });
  render(<WorldPresetPicker aria-label="Preset" value="preset-0" onValueChange={onValueChange} />);
  return onValueChange;
}

describe("WorldPresetPicker", () => {
  it("is a segmented control for three presets", () => {
    show(3);
    expect(
      within(screen.getByRole("radiogroup", { name: "Preset" })).getAllByRole("radio")
    ).toHaveLength(3);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("is a select listing all four when there are four, under the same name", () => {
    const onValueChange = show(4);
    const select = screen.getByRole("combobox", { name: "Preset" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Preset 0", "Preset 1", "Preset 2", "Preset 3"]);
    fireEvent.change(select, { target: { value: "preset-3" } });
    expect(onValueChange).toHaveBeenCalledWith("preset-3");
  });
});
