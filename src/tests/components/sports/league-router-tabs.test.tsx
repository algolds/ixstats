import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

// Babel hoists jest.mock and the imports above module constants, so the fixtures live in
// function declarations (which hoist too) and are only read when a mock factory runs.
function mockLeague() {
  return {
    id: "lg1",
    name: "Imperial Premier",
    sportPreset: "football",
    archetype: "league",
    teams: [],
    seasons: [{ id: "s1", status: "in_progress", seasonNumber: 3 }],
    viewerCanManage: true,
    promotionCount: 0,
    relegationCount: 0,
  };
}
function mockQuery(data: unknown) {
  return () => ({ data, isLoading: false });
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
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ sports: new Proxy({}, { get: () => ({ invalidate: jest.fn() }) }) }),
    sports: {
      getLeague: { useQuery: mockQuery(mockLeague()) },
      getDraftPicks: { useQuery: mockQuery([]) },
      getStandings: { useQuery: mockQuery([]) },
      getSchedule: { useQuery: mockQuery({ matches: [] }) },
      startSeason: { useMutation: mockMutation() },
      simulateMatchDay: { useMutation: mockMutation() },
      simulateFullSeason: { useMutation: mockMutation() },
      transitionToNextSeason: { useMutation: mockMutation() },
    },
  },
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/lib/sound/cuelume", () => ({ soundCues: { success: jest.fn() } }));

jest.mock("~/components/sports/league/tabs/LeagueOverviewTab", () => ({
  LeagueOverviewTab: mockStub("tab-overview"),
}));
jest.mock("~/components/sports/league/tabs/LeagueStandingsTab", () => ({
  LeagueStandingsTab: mockStub("tab-standings"),
}));
jest.mock("~/components/sports/league/tabs/LeagueScheduleTab", () => ({
  LeagueScheduleTab: mockStub("tab-schedule"),
}));
jest.mock("~/components/sports/league/tabs/LeagueBracketTab", () => ({
  LeagueBracketTab: mockStub("tab-bracket"),
}));
jest.mock("~/components/sports/league/tabs/LeagueRacesTab", () => ({
  LeagueRacesTab: mockStub("tab-races"),
}));
jest.mock("~/components/sports/league/tabs/LeagueTeamsTab", () => ({
  LeagueTeamsTab: mockStub("tab-teams"),
}));
jest.mock("~/components/sports/league/tabs/LeagueDraftTab", () => ({
  LeagueDraftTab: mockStub("tab-draft"),
}));
jest.mock("~/components/sports/league/tabs/LeagueArchiveTab", () => ({
  LeagueArchiveTab: mockStub("tab-history"),
}));
jest.mock("~/components/sports/league/LeagueMasthead", () => ({
  LeagueMasthead: mockStub("masthead"),
}));
jest.mock("~/components/sports/league/MatchdayTape", () => ({ MatchdayTape: mockStub("tape") }));
jest.mock("~/components/sports/league/MatchDetailModal", () => ({
  MatchDetailModal: mockStub("match-modal"),
}));
jest.mock("~/components/sports/league/LeagueSettingsModal", () => ({
  LeagueSettingsModal: mockStub("settings-modal"),
}));
jest.mock("~/components/sports/league/TeamSettingsModal", () => ({
  TeamSettingsModal: mockStub("team-modal"),
}));
jest.mock("~/components/sports/league/LeagueBrandWidgets", () => ({
  LeagueControlDeck: mockStub("control-deck"),
  ReigningChampionWidget: mockStub("champion"),
}));
jest.mock("~/components/sports/core/ChampionshipRevealOverlay", () => ({
  ChampionshipRevealOverlay: mockStub("reveal"),
}));
jest.mock("~/components/sports/core/SportsCommandPalette", () => ({
  SportsCommandPalette: mockStub("palette"),
}));

import { LeagueRouter } from "~/components/sports/league/LeagueRouter";

beforeAll(() => {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => window.history.replaceState(null, "", "/myleague/lg1"));

describe("LeagueRouter", () => {
  it("renders the league views as tabs under the page header, with a back link to the lobby", () => {
    render(<LeagueRouter leagueId="lg1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Imperial Premier" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Leagues/ }).getAttribute("href")).toBe("/myleague");
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Overview", "Standings", "Schedule", "Franchises", "History"]);
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByTestId("tab-overview")).toBeTruthy();
  });

  it("opens on the section named in the URL", () => {
    window.history.replaceState(null, "", "/myleague/lg1?section=schedule");
    render(<LeagueRouter leagueId="lg1" />);
    expect(screen.getByRole("tab", { name: "Schedule" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByTestId("tab-schedule")).toBeTruthy();
  });

  it("switching a tab shows that view and writes it to the section URL param", () => {
    render(<LeagueRouter leagueId="lg1" />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Standings" }));
    fireEvent.click(screen.getByRole("tab", { name: "Standings" }));

    expect(screen.getByTestId("tab-standings")).toBeTruthy();
    expect(screen.queryByTestId("tab-overview")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("section")).toBe("standings");
  });
});
