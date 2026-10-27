/**
 * MyCountry section tabs at phone width (P2-15): the strip scrolls sideways instead of squeezing,
 * so "Report / Budget / Taxes / Trade" never read "Rep… / Budg…".
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { Bank, Coins, Globe, Reports } from "iconoir-react";
import { SectionTabBar } from "~/components/mycountry/shared/primitives/SectionTabBar";

const TABS = [
  { id: "report", label: "Report", icon: Reports },
  { id: "budget", label: "Budget", icon: Bank },
  { id: "taxes", label: "Taxes", icon: Coins },
  { id: "trade", label: "Trade", icon: Globe },
] as const;

it("scrolls the strip and keeps every label whole", () => {
  const { container } = render(
    <SectionTabBar tabs={TABS} activeTab="report" onChange={jest.fn()} />
  );
  const list = screen.getByRole("tablist");
  expect(list.className).toContain("overflow-x-auto");
  expect(list.className).toContain("max-w-full");
  for (const tab of screen.getAllByRole("tab")) expect(tab.className).toContain("shrink-0");
  expect(container.querySelector(".truncate")).toBeNull();
  expect(screen.getByRole("tab", { name: "Budget" }).textContent).toBe("Budget");
});
