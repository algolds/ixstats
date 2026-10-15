import React from "react";
import { render, screen } from "@testing-library/react";

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
      syncMyCollectorAchievements: { useMutation: () => ({ mutate: sync }) },
    },
  },
}));
jest.mock("~/components/achievements/tabs/AllAchievementsTab", () => ({
  AllAchievementsTab: () => <div data-testid="catalogue" />,
}));
jest.mock("~/components/achievements/tabs/ShowcaseTab", () => ({ ShowcaseTab: () => null }));
jest.mock("~/components/achievements/tabs/LeaderboardTab", () => ({ LeaderboardTab: () => null }));

import VaultAchievementsPage from "~/app/vault/achievements/page";

describe("/vault/achievements", () => {
  it("titles the page for assistive tech, opens on the tabs with no standing hero, and syncs on load", () => {
    render(<VaultAchievementsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Achievements" })).toHaveClass("sr-only");
    expect(screen.queryByText("Achievements unlocked")).toBeNull();
    expect(screen.queryByText(/mastered/)).toBeNull();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "All",
      "Lorewards",
      "Showcase",
      "Leaderboard",
    ]);
    expect(screen.getByTestId("catalogue")).toBeInTheDocument();
    expect(sync).toHaveBeenCalled();
  });
});
