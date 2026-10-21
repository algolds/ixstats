/** The cards admin shell: nine flat tabs, opened from `?tab=` (and the old `?tab=settings&subtab=`). */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useSearchParams: jest.fn(),
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

import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import CardsPanel from "~/app/admin/cards/CardsPanel";

/** Puts the page at `/admin/cards?<search>`, as the address bar and `useSearchParams` both see it. */
function openAt(search: string) {
  window.history.replaceState({}, "", search ? `/admin/cards?${search}` : "/admin/cards");
  jest.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams(search));
}

/** The browser's back or forward button, landing on `search`. */
function goBackTo(search: string) {
  window.history.replaceState({}, "", `/admin/cards?${search}`);
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

const pickTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });

describe("CardsPanel", () => {
  it("opens the tab an old settings link names, and only that panel", () => {
    openAt("tab=settings&subtab=takedowns");
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
    openAt("subtab=packs");
    render(<CardsPanel />);
    expect(screen.getByText("overview panel")).toBeInTheDocument();

    pickTab("Seasons");
    expect(screen.getByText("seasons panel")).toBeInTheDocument();
    expect(window.location.search).toBe("?tab=seasons");
  });

  it("follows back and forward to the tab the URL names", () => {
    openAt("tab=packs");
    render(<CardsPanel />);
    pickTab("Seasons");
    expect(screen.getByText("seasons panel")).toBeInTheDocument();

    goBackTo("tab=packs");
    expect(screen.getByText("packs panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Packs" })).toHaveAttribute("aria-selected", "true");

    goBackTo("tab=settings&subtab=takedowns");
    expect(screen.getByText("compliance panel")).toBeInTheDocument();
  });
});
