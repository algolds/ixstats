/** The shared document ribbon (passport and country page): tabs pattern, roving tabindex, counts. */
import { fireEvent, render, screen } from "@testing-library/react";
import { Clock, Globe, Page } from "iconoir-react";
import { DocumentRibbon, ribbonPanelId, ribbonTabId } from "~/components/shared/document/DocumentRibbon";

const TABS = [
  { id: "one", label: "One", icon: Globe },
  { id: "two", label: "Two", icon: Page },
  { id: "three", label: "Three", icon: Clock },
] as const;

function setup(activeTab: "one" | "two" | "three" = "one", counts = {}) {
  const onSelectTab = jest.fn();
  render(
    <DocumentRibbon
      tabs={TABS}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      counts={counts}
      idBase="doc"
      label="Document sections"
    />
  );
  return onSelectTab;
}

describe("DocumentRibbon", () => {
  it("is a labelled tablist with the active tab selected and in the tab order", () => {
    setup("two");
    expect(screen.getByRole("tablist", { name: "Document sections" })).toBeInTheDocument();
    const active = screen.getByRole("tab", { name: "Two" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveAttribute("tabindex", "0");
    expect(active).toHaveAttribute("aria-controls", ribbonPanelId("doc"));
    expect(active).toHaveAttribute("id", ribbonTabId("doc", "two"));
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "-1");
  });

  it("wraps ArrowRight from the last tab to the first, and End selects the last", () => {
    const onSelect = setup("three");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Three" }), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("one");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Three" }), { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith("three");
  });

  it("shows a positive count and hides zero", () => {
    setup("one", { two: 3, three: 0 });
    expect(screen.getByRole("tab", { name: /Two/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveTextContent(/^Three$/);
  });
});
