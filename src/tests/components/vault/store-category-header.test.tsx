/** The Store window's section tabs: they fit the window at any width, scrolling inside their own track. */
import React from "react";
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
  it("puts the track in a block, centred, rather than in a row that sizes it to its content", () => {
    const { container, list } = renderHeader();
    const wrapper = container.firstElementChild;
    expect(wrapper).not.toHaveClass("flex");
    expect(wrapper).toContainElement(list);
    expect(list).toHaveClass("w-full", "mx-auto", "sm:max-w-xl");
  });

  it("scrolls the track rather than squeezing a tab below its label", () => {
    const { list } = renderHeader();
    expect(list).toHaveClass("max-w-full", "overflow-x-auto");
    for (const tab of within(list).getAllByRole("tab")) {
      expect(tab).toHaveClass("min-w-max", "shrink-0");
      expect(tab).not.toHaveClass("min-w-0");
    }
  });
});
