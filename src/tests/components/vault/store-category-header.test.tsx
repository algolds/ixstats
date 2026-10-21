/** The Store window's section tabs: they fit the window at any width, scrolling inside their own track. */
import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Package, Shop, StatUp } from "iconoir-react";

import { StoreCategoryHeader } from "~/components/vault/sections/marketplace/store/StoreCategoryHeader";

const TABS = [
  { id: "my-packs" as const, label: "My packs", icon: Package },
  { id: "packs" as const, label: "Packs", icon: Shop },
  { id: "upgrades" as const, label: "Account upgrades", icon: StatUp },
];

function renderHeader(onTabChange = jest.fn()) {
  const view = render(
    <StoreCategoryHeader tabs={TABS} activeTab="packs" onTabChange={onTabChange} myPacksCount={1} />
  );
  return { ...view, onTabChange, list: screen.getByRole("tablist", { name: "Sections" }) };
}

describe("StoreCategoryHeader", () => {
  it("offers each section as a tab, with the unopened pack count on My packs", () => {
    const { list, onTabChange } = renderHeader();
    expect(
      within(list)
        .getAllByRole("tab")
        .map((t) => t.textContent)
    ).toEqual(["My packs1", "Packs", "Account upgrades"]);
    expect(within(list).getByRole("tab", { name: "My packs (1)" })).toBeInTheDocument();
    fireEvent.mouseDown(within(list).getByRole("tab", { name: "Account upgrades" }));
    expect(onTabChange).toHaveBeenCalledWith("upgrades");
  });

  // A flex row would size the tabs to their content and centre them past both edges of a phone's window, where
  // the window clips them. In a block the track takes the window's width and scrolls.
});
