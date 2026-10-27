import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FeatureContextMenu } from "~/components/maps/editor/FeatureContextMenu";

const city = { id: "c1", name: "Lucrecia", type: "city", wikiPageTitle: "Lucrecia" };

function renderMenu(overrides: Partial<React.ComponentProps<typeof FeatureContextMenu>> = {}) {
  const props = {
    x: 120,
    y: 80,
    feature: city,
    onEdit: jest.fn(),
    onDuplicate: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    onOpenWiki: jest.fn(),
    onSplitCity: jest.fn(),
    ...overrides,
  };
  render(<FeatureContextMenu {...props} />);
  return props;
}

describe("FeatureContextMenu", () => {
  it("is a labelled menu with the feature's actions, destructive last in its group", () => {
    renderMenu();
    const menu = screen.getByRole("menu", { name: "Lucrecia actions" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
    ).toEqual(["Edit properties", "Duplicate", "Split city", "Delete", "Open wiki page"]);
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "data-variant",
      "destructive"
    );
  });

  it("runs the chosen action and closes", () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Split city" }));
    expect(props.onSplitCity).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const props = renderMenu();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("offers only gap creation for negative space", () => {
    const onCreateFromGap = jest.fn();
    renderMenu({ feature: { id: "gap", name: "Negative Space", type: "gap" }, onCreateFromGap });
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Create region from gap",
    ]);
  });
});
