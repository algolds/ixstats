import React from "react";
import { render, screen } from "@testing-library/react";

const getMySummary = jest.fn();
const sync = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/vault/achievements",
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "user_1" } }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      achievements: {
        getAllWithStatus: { invalidate: jest.fn() },
        getMySummary: { invalidate: jest.fn() },
      },
    }),
    users: { getProfile: { useQuery: () => ({ data: { countryId: "c1" } }) } },
    achievements: {
      getAllWithStatus: { useQuery: () => ({ data: [] }) },
      getMySummary: { useQuery: () => getMySummary() },
      syncMyCollectorAchievements: { useMutation: () => ({ mutate: sync }) },
    },
  },
}));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));
jest.mock("~/components/achievements/tabs/AllAchievementsTab", () => ({
  AllAchievementsTab: () => <div data-testid="catalogue" />,
}));
jest.mock("~/components/achievements/tabs/ShowcaseTab", () => ({ ShowcaseTab: () => null }));
jest.mock("~/components/achievements/tabs/LeaderboardTab", () => ({ LeaderboardTab: () => null }));

import VaultAchievementsPage from "~/app/vault/achievements/page";

describe("/vault/achievements", () => {
  it("shows the player's standing above the tabs, and syncs on load", () => {
    getMySummary.mockReturnValue({ data: { unlocked: 12, activeTotal: 48, points: 340, rank: 7 } });
    render(<VaultAchievementsPage />);

    expect(screen.getByRole("heading", { name: "Achievements" })).toBeInTheDocument();
    expect(screen.getByText("25% mastered")).toBeInTheDocument();
    expect(screen.getByText("of 48")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "All",
      "Lorewards",
      "Showcase",
      "Leaderboard",
    ]);
    expect(screen.getByTestId("catalogue")).toBeInTheDocument();
    expect(sync).toHaveBeenCalled();
  });

  it("calls an unranked player unranked", () => {
    getMySummary.mockReturnValue({ data: { unlocked: 0, activeTotal: 48, points: 0, rank: null } });
    render(<VaultAchievementsPage />);
    expect(screen.getByText("Unranked")).toBeInTheDocument();
  });
});
