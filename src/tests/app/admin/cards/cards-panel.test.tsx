/** The cards admin shell: nine flat tabs, opened from `?tab=` (and the old `?tab=settings&subtab=`). */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

let mockSearch = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("~/app/admin/cards/overview", () => ({ OverviewTab: () => <p>overview panel</p> }));
jest.mock("~/app/admin/cards/library", () => ({ LibraryTab: () => <p>library panel</p> }));
jest.mock("~/app/admin/cards/imports", () => ({ ImportsTab: () => <p>imports panel</p> }));
jest.mock("~/app/admin/cards/curation", () => ({ CurationTab: () => <p>curation panel</p> }));
jest.mock("~/app/admin/cards/packs", () => ({ PacksTab: () => <p>packs panel</p> }));
jest.mock("~/app/admin/cards/economy", () => ({ EconomyTab: () => <p>economy panel</p> }));
jest.mock("~/app/admin/cards/seasons", () => ({ SeasonsTab: () => <p>seasons panel</p> }));
jest.mock("~/app/admin/cards/compliance", () => ({
  ComplianceTab: () => <p>compliance panel</p>,
}));
jest.mock("~/app/admin/cards/designer", () => ({ DesignerTab: () => <p>designer panel</p> }));

import CardsPanel from "~/app/admin/cards/CardsPanel";

describe("CardsPanel", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin/cards");
  });

  it("opens the tab an old settings link names, and only that panel", () => {
    mockSearch = "tab=settings&subtab=takedowns";
    render(<CardsPanel />);
    expect(screen.getAllByRole("tab")).toHaveLength(9);
    expect(screen.getByRole("tab", { name: "Compliance" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("compliance panel")).toBeInTheDocument();
    expect(screen.queryByText("overview panel")).not.toBeInTheDocument();
  });

  it("switches tab and writes it to ?tab=, dropping the old subtab", () => {
    mockSearch = "";
    window.history.replaceState({}, "", "/admin/cards?tab=settings&subtab=packs");
    render(<CardsPanel />);
    expect(screen.getByText("overview panel")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Seasons" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText("seasons panel")).toBeInTheDocument();
    expect(window.location.search).toBe("?tab=seasons");
  });
});
