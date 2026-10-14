import React from "react";
import { render, screen } from "@testing-library/react";

const playerBoard = jest.fn();
const countryBoard = jest.fn();
const countryAchievements = jest.fn();
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("~/trpc/react", () => ({
  api: {
    achievements: {
      getPlayerLeaderboard: { useQuery: (...args: unknown[]) => playerBoard(...args) },
      getCountryLeaderboard: { useQuery: (...args: unknown[]) => countryBoard(...args) },
      getLeaderboard: { useQuery: (...args: unknown[]) => countryAchievements(...args) },
    },
  },
}));

jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));

import { LeaderboardTab } from "~/components/achievements/tabs/LeaderboardTab";
import { CountryLeaderboards } from "~/components/achievements/tabs/CountryLeaderboards";

const row = (rank: number, name: string, isViewer = false) => ({
  rank,
  name,
  handle: name,
  totalPoints: 100 - rank,
  achievementCount: 10 - rank,
  rareAchievements: 1,
  isViewer,
});

beforeEach(() => {
  jest.clearAllMocks();
  countryBoard.mockReturnValue({ data: [], isLoading: false });
  countryAchievements.mockReturnValue({ data: [], isLoading: false });
});

describe("Vault LeaderboardTab", () => {
  it("ranks players by achievement points and never asks for the country boards", () => {
    playerBoard.mockReturnValue({
      data: [row(1, "alpha"), row(2, "beta", true), row(3, "gamma"), row(4, "delta")],
      isLoading: false,
    });
    render(<LeaderboardTab />);

    expect(playerBoard).toHaveBeenCalledWith({ limit: 25 }, expect.anything());
    expect(countryBoard).not.toHaveBeenCalled();
    expect(countryAchievements).not.toHaveBeenCalled();
    expect(screen.getAllByText("alpha").length).toBeGreaterThan(0);
    expect(screen.getByText("delta")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("says so when nobody has unlocked anything", () => {
    playerBoard.mockReturnValue({ data: [], isLoading: false });
    render(<LeaderboardTab />);
    expect(screen.getByText("No achievements unlocked yet")).toBeInTheDocument();
  });
});

describe("CountryLeaderboards", () => {
  it("keeps the nation boards: achievements by nation first, other metrics on demand", () => {
    countryAchievements.mockReturnValue({
      data: [
        {
          countryId: "c1",
          countryName: "Arcadia",
          achievementCount: 3,
          rareAchievements: 1,
          totalPoints: 30,
        },
      ],
      isLoading: false,
    });
    render(<CountryLeaderboards />);

    expect(screen.getByText("World leaderboards")).toBeInTheDocument();
    expect(screen.getAllByText("Arcadia").length).toBeGreaterThan(0);
    expect(playerBoard).not.toHaveBeenCalled();
  });
});
