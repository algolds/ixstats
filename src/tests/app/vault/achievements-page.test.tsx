import React from "react";
import { render, screen } from "@testing-library/react";

const sync = jest.fn();
const mockInvalidate = {
  getAllWithStatus: jest.fn(),
  getMySummary: jest.fn(),
  getNextUnlock: jest.fn(),
};
let mockOnSync: (() => void) | undefined;
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
        getAllWithStatus: { invalidate: mockInvalidate.getAllWithStatus },
        getMySummary: { invalidate: mockInvalidate.getMySummary },
        getNextUnlock: { invalidate: mockInvalidate.getNextUnlock },
      },
    }),
    users: { getProfile: { useQuery: () => ({ data: { countryId: "c1" } }) } },
    achievements: {
      getAllWithStatus: { useQuery: () => ({ data: [] }) },
      syncMyCollectorAchievements: {
        useMutation: (options: { onSuccess: () => void }) => {
          mockOnSync = options.onSuccess;
          return { mutate: sync };
        },
      },
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

  // The page has no header toolbar, so its first row pads by Halo's floating band (3.5rem), as the Wallet does.
  it("starts its tabs below the shell's floating header, so the header never takes their taps", () => {
    render(<VaultAchievementsPage />);
    expect(
      screen.getByRole("tablist", { name: "Achievements sections" }).closest(".pt-14")
    ).not.toBeNull();
  });

  it("refreshes the catalogue, the Wallet summary and the next-up achievement after a sync", () => {
    render(<VaultAchievementsPage />);
    mockOnSync?.();
    expect(mockInvalidate.getAllWithStatus).toHaveBeenCalled();
    expect(mockInvalidate.getMySummary).toHaveBeenCalled();
    // An unlock can leave the nearest locked achievement out of date.
    expect(mockInvalidate.getNextUnlock).toHaveBeenCalled();
  });
});
