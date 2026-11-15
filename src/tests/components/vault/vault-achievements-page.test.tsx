import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const replaceMock = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null }),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      getProfile: { useQuery: () => ({ data: null, isLoading: false }) },
    },
    achievements: {
      getAllWithStatus: {
        useQuery: () => ({
          data: [],
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        }),
      },
      syncMyCollectorAchievements: {
        useMutation: () => ({ mutate: jest.fn() }),
      },
    },
    useUtils: () => ({
      achievements: {
        getAllWithStatus: { invalidate: jest.fn() },
        getMySummary: { invalidate: jest.fn() },
        getNextUnlock: { invalidate: jest.fn() },
      },
    }),
  },
}));

jest.mock("~/components/achievements/VaultLorewardsPanel", () => ({
  VaultLorewardsPanel: () => <div data-testid="lorewards-panel">Lorewards panel</div>,
}));

jest.mock("~/components/achievements/tabs/AllAchievementsTab", () => ({
  AllAchievementsTab: () => <div data-testid="achievements-catalogue">Achievements catalogue</div>,
}));

import VaultAchievementsPage from "~/app/vault/achievements/page";

describe("VaultAchievementsPage category switcher", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it("renders the Achievement categories SegmentedControl and switches between Achievements and Lorewards", () => {
    const { rerender } = render(<VaultAchievementsPage />);

    const group = screen.getByRole("radiogroup", { name: "Achievement categories" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Achievements" })).toBeInTheDocument();
    expect(screen.getByTestId("achievements-catalogue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Lorewards" }));
    expect(replaceMock).toHaveBeenCalledWith("/vault/achievements?tab=lorewards", {
      scroll: false,
    });

    mockSearchParams = new URLSearchParams("tab=lorewards");
    rerender(<VaultAchievementsPage />);
    expect(screen.getByRole("heading", { name: "Lorewards" })).toBeInTheDocument();
    expect(screen.getByTestId("lorewards-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Achievements" }));
    expect(replaceMock).toHaveBeenCalledWith("/vault/achievements", { scroll: false });
  });
});
