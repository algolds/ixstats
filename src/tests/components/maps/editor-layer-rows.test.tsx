/**
 * The editor's Layers panel rows: the realm's relief is a row of its own, on by default, switched like the map's
 * own relief overlay, and never lockable.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import { buildLayers } from "~/components/maps/editor/utils/layer-rows";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

const noLayerStates = {};
const noRelief = { available: false, shown: false };

describe("buildLayers", () => {
  it("has no Relief row on a realm without relief", () => {
    const ids = buildLayers(noLayerStates, new Set(), noRelief).map((layer) => layer.id);
    expect(ids).not.toContain("relief");
    expect(ids).toContain("climate");
  });

  it("has a Relief row after Climate Zones when the realm has relief, showing whether it is on", () => {
    const rows = buildLayers(noLayerStates, new Set(), { available: true, shown: true });
    expect(rows.map((layer) => layer.id).slice(0, 3)).toEqual(["border", "climate", "relief"]);
    expect(rows.find((layer) => layer.id === "relief")).toMatchObject({
      name: "Relief",
      visible: true,
      locked: true,
    });
    const off = buildLayers(noLayerStates, new Set(), { available: true, shown: false });
    expect(off.find((layer) => layer.id === "relief")?.visible).toBe(false);
  });

  it("leaves the other rows as they were", () => {
    const rows = buildLayers(
      { regions: { visible: false, locked: true, opacity: 0.3 } },
      new Set(["climate"]),
      noRelief
    );
    expect(rows.find((layer) => layer.id === "regions")).toMatchObject({
      visible: false,
      locked: true,
      opacity: 0.3,
    });
    expect(rows.find((layer) => layer.id === "climate")).toMatchObject({ visible: true });
    expect(rows.find((layer) => layer.id === "border")).toMatchObject({ visible: true });
  });
});

describe("the Relief row of the Layers panel", () => {
  beforeAll(stubResizeObserver);

  const renderPanel = (shown: boolean) => {
    const onToggleVisibility = jest.fn();
    render(
      <LayerPanel
        layers={buildLayers(noLayerStates, new Set(), { available: true, shown })}
        onToggleVisibility={onToggleVisibility}
      />
    );
    const row = screen.getByText("Relief").closest("div")!;
    return { onToggleVisibility, row };
  };

  it("shows a row named Relief with a switch that reports the toggle", () => {
    const { onToggleVisibility, row } = renderPanel(true);
    fireEvent.click(within(row).getByRole("button", { name: "Hide layer" }));
    expect(onToggleVisibility).toHaveBeenCalledWith("relief");
  });

  it("offers to show the relief while it is off", () => {
    const { row } = renderPanel(false);
    expect(within(row).getByRole("button", { name: "Show layer" })).toBeInTheDocument();
  });

  it("has no lock and no feature list on that row", () => {
    const { row } = renderPanel(true);
    expect(within(row).queryByRole("button", { name: /lock layer/i })).toBeNull();
    expect(within(row).queryByRole("button", { name: /(expand|collapse) relief/i })).toBeNull();
  });
});
