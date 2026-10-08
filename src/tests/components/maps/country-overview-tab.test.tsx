import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";

jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html }: { html: string }) => <p>{html}</p>,
}));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { CountryOverviewTab } from "~/components/maps/core/components/CountryOverviewTab";

function renderTab(summary: Record<string, string | number | null>) {
  return render(
    <CountryOverviewTab
      summary={{ population: 1_000_000, totalGdp: 5e10, gdpPerCapita: 50_000, ...summary }}
      sovereignty={{ sovereign: null, subjects: [] }}
      neighbors={[]}
      wikiRichIntro={null}
      isOwner={false}
      setActiveTab={() => undefined}
      setActiveModal={() => undefined}
    />
  );
}

// Eurth map port, phase 1: the map summary carries the capital (NationalIdentity.capitalCity); the click
// panel shows it among the overview figures.
describe("CountryOverviewTab capital", () => {
  it("shows the capital among the overview figures", () => {
    renderTab({ capitalCity: "Tagmatika" });

    expect(screen.getByText("Capital")).toBeTruthy();
    expect(screen.getByText("Tagmatika")).toBeTruthy();
  });

  it("leaves the figure out when the country has no capital", () => {
    renderTab({ capitalCity: null });

    expect(screen.queryByText("Capital")).toBeNull();
    expect(screen.getByText("Population")).toBeTruthy();
  });
});

describe("CountryOverviewTab geography", () => {
  it("leaves an unknown region out, keeping the continent", () => {
    renderTab({ continent: "Europa", region: "Unknown" });

    expect(screen.getByRole("button", { name: "Europa" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unknown" })).toBeNull();
  });

  it("drops the section when neither is known", () => {
    renderTab({ continent: null, region: "unknown" });

    expect(screen.queryByText("Geography")).toBeNull();
  });
});
