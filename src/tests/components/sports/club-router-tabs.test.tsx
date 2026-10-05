import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

// Babel hoists jest.mock and the imports above module constants, so the fixtures live in
// function declarations (which hoist too) and are only read when a mock factory runs.
function mockOverview() {
  return {
    team: {
      id: "t1",
      name: "Aurelia United",
      shortName: "AUR",
      city: "Aurelia",
      leagueId: "lg1",
      league: { name: "Imperial Premier", sportPreset: "football" },
      players: [],
    },
    activeSeason: null,
    currentStandings: [],
    upcomingMatches: [],
  };
}
function mockQuery(data: unknown) {
  return () => ({ data, isLoading: false, refetch: jest.fn() });
}
function mockMutation() {
  return () => ({ mutate: jest.fn(), isPending: false });
}
function mockStub(name: string) {
  return () => <div data-testid={name} />;
}

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "u1" } }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    sports: {
      getTeamOverview: { useQuery: mockQuery(mockOverview()) },
      getTeam: { useQuery: mockQuery(undefined) },
      getLiveMatches: { useQuery: mockQuery([]) },
      updateTeamTactics: { useMutation: mockMutation() },
      setClubNotifications: { useMutation: mockMutation() },
      listPlayerForTransfer: { useMutation: mockMutation() },
      claimTeam: { useMutation: mockMutation() },
    },
  },
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));

jest.mock("~/components/sports/club/sections/ClubOverviewSection", () => ({
  ClubOverviewSection: mockStub("section-overview"),
}));
jest.mock("~/components/sports/club/sections/ClubRosterSection", () => ({
  ClubRosterSection: mockStub("section-roster"),
}));
jest.mock("~/components/sports/club/sections/ClubTacticsSection", () => ({
  ClubTacticsSection: mockStub("section-tactics"),
}));
jest.mock("~/components/sports/club/sections/ClubTransfersSection", () => ({
  ClubTransfersSection: mockStub("section-transfers"),
}));
jest.mock("~/components/sports/club/sections/ClubManagementSection", () => ({
  ClubManagementSection: mockStub("section-management"),
}));
jest.mock("~/components/sports/club/sections/ClubHistorySection", () => ({
  ClubHistorySection: mockStub("section-history"),
}));
jest.mock("~/components/sports/league/TeamSettingsModal", () => ({
  TeamSettingsModal: mockStub("team-modal"),
}));

import { ClubRouter } from "~/components/sports/club/ClubRouter";

beforeAll(() => {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => window.history.replaceState(null, "", "/myclub/t1"));

describe("ClubRouter", () => {
  it("renders the club views as tabs under the page header, with a back link to the lobby", () => {
    render(<ClubRouter teamId="t1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Aurelia United" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /MyClub/ }).getAttribute("href")).toBe("/myclub");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Dashboard",
      "Roster",
      "Tactics",
      "Transfers",
      "Management",
      "History",
    ]);
    expect(screen.getByRole("tab", { name: "Dashboard" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByTestId("section-overview")).toBeTruthy();
  });

  it("opens on the section named in the URL", () => {
    window.history.replaceState(null, "", "/myclub/t1?section=tactics");
    render(<ClubRouter teamId="t1" />);
    expect(screen.getByRole("tab", { name: "Tactics" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("section-tactics")).toBeTruthy();
  });

  it("still honours the legacy tab param", () => {
    window.history.replaceState(null, "", "/myclub/t1?tab=roster");
    render(<ClubRouter teamId="t1" />);
    expect(screen.getByTestId("section-roster")).toBeTruthy();
  });

  it("switching a tab shows that view and writes it to the section URL param", () => {
    window.history.replaceState(null, "", "/myclub/t1?tab=roster");
    render(<ClubRouter teamId="t1" />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Transfers" }));
    fireEvent.click(screen.getByRole("tab", { name: "Transfers" }));

    expect(screen.getByTestId("section-transfers")).toBeTruthy();
    expect(screen.queryByTestId("section-roster")).toBeNull();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("section")).toBe("transfers");
    // The legacy param is dropped so the URL has one source of truth.
    expect(params.has("tab")).toBe(false);
  });
});
