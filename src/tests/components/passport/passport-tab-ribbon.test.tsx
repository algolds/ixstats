/**
 * The passport's mid-card index ribbon is a WAI-ARIA tablist: tabs with aria-selected, the
 * selected tab controls the panel, roving tabindex, and arrow/Home/End keys move and select.
 */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import {
  PassportTabRibbon,
  passportTabId,
  passportTabPanelId,
} from "~/components/passport/document/PassportTabRibbon";
import type { PassportTabType } from "~/components/passport/types";

function Harness({ initial = "overview" as PassportTabType }) {
  const [tab, setTab] = useState<PassportTabType>(initial);
  return (
    <>
      <PassportTabRibbon
        activeTab={tab}
        onSelectTab={setTab}
        counts={{ realms: 3 }}
        idBase="pp"
      />
      <div role="tabpanel" id={passportTabPanelId("pp")} aria-labelledby={passportTabId("pp", tab)}>
        {tab} body
      </div>
    </>
  );
}

describe("PassportTabRibbon", () => {
  it("renders a labelled tablist of tabs, not pressed buttons", () => {
    render(<Harness />);
    const tablist = screen.getByRole("tablist", { name: "Passport sections" });
    const tabs = screen.getAllByRole("tab");
    expect(tablist).toContainElement(tabs[0]!);
    expect(tabs.map((t) => t.textContent)).toEqual([
      "01.Overview",
      "02.Realms3",
      "03.Work",
      "04.Vault",
      "05.History",
    ]);
    for (const t of tabs) expect(t).not.toHaveAttribute("aria-pressed");
  });

  it("marks the selected tab and wires it to the panel", () => {
    render(<Harness initial="work" />);
    const work = screen.getByRole("tab", { name: /Work/ });
    expect(work).toHaveAttribute("aria-selected", "true");
    expect(work).toHaveAttribute("aria-controls", "pp-panel");
    expect(work).toHaveAttribute("tabindex", "0");
    const overview = screen.getByRole("tab", { name: /Overview/ });
    expect(overview).toHaveAttribute("aria-selected", "false");
    expect(overview).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: /Work/ })).toHaveTextContent("work body");
  });

  it("selects on click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: /Vault/ }));
    expect(screen.getByRole("tab", { name: /Vault/ })).toHaveAttribute("aria-selected", "true");
  });

  it("moves focus and selection with the arrow keys, wrapping, and Home/End", () => {
    render(<Harness />);
    const overview = screen.getByRole("tab", { name: /Overview/ });
    overview.focus();

    fireEvent.keyDown(overview, { key: "ArrowRight" });
    const realms = screen.getByRole("tab", { name: /Realms/ });
    expect(realms).toHaveFocus();
    expect(realms).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(realms, { key: "End" });
    const history = screen.getByRole("tab", { name: /History/ });
    expect(history).toHaveFocus();
    expect(history).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(history, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tab", { name: /Overview/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /History/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /History/ }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
  });
});
