import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";

let mockInboxCount = 0;
let mockCountry: Record<string, unknown> | null = null;

jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: mockCountry }),
}));

jest.mock("~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox", () => ({
  useDiplomacyInboxCount: () => ({ count: mockInboxCount, isLoading: false, isError: false }),
}));

import { DomainPeeksCard } from "~/components/mycountry/shell/DomainPeeksCard";

describe("DomainPeeksCard", () => {
  beforeEach(() => {
    mockInboxCount = 0;
    mockCountry = {
      id: "c1",
      stabilityMetrics: { stabilityScore: 71.4 },
      calculatedStats: { gdpGrowth: 0.034 },
    };
  });

  it("renders one link per domain with its peek as the trailing value", () => {
    render(<DomainPeeksCard />);
    const nav = screen.getByRole("region", { name: "Domains" });
    expect(nav.closest("[data-content]")?.getAttribute("data-content")).toBe("navigation");

    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/mycountry/economy",
      "/mycountry/politics",
      "/mycountry/diplomacy",
      "/mycountry/executive",
    ]);
    expect(within(links[0]!).getByText("Economy")).toBeTruthy();
    expect(within(links[0]!).getByText("GDP growth +3.4%")).toBeTruthy();
    expect(within(links[1]!).getByText("Stability 71%")).toBeTruthy();
    expect(within(links[2]!).getByText("Relations, embassies and alliances")).toBeTruthy();
    expect(within(links[3]!).getByText("Directives")).toBeTruthy();
  });

  it("falls back to a plain description when the figures are missing", () => {
    mockCountry = { id: "c1" };
    render(<DomainPeeksCard />);
    expect(screen.getByText("Cabinet, parties and bills")).toBeTruthy();
    expect(screen.getByText("Budget, tax and trade")).toBeTruthy();
  });

  it("peeks the diplomacy inbox when proposals await an answer", () => {
    mockInboxCount = 3;
    render(<DomainPeeksCard />);
    expect(screen.getByText("3 awaiting your answer")).toBeTruthy();
    expect(screen.queryByText("Relations, embassies and alliances")).toBeNull();
  });

  it("switches sections in place on a plain click and leaves modified clicks to the browser", () => {
    const calls: string[] = [];
    render(<DomainPeeksCard onNavigate={(s) => calls.push(s)} />);
    const directives = screen.getByRole("link", { name: /Directives/ });
    expect(fireEvent.click(directives)).toBe(false);
    expect(calls).toEqual(["executive"]);
    expect(fireEvent.click(directives, { metaKey: true })).toBe(true);
    expect(calls).toEqual(["executive"]);
  });
});
