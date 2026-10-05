/**
 * The dashboard has one column of its own: the feed. Trending, the blurb, countries to explore and the
 * economic tiers live in an Inspector (an aside at 1280px and up, a sheet opened by "Trends" below).
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { UnifiedDashboardSection } from "~/components/dashboard/sections/UnifiedDashboardSection";

let wide = true;
jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => wide }));
jest.mock("~/trpc/react", () => {
  const query = (data: unknown) => ({ useQuery: () => ({ data }) });
  return {
    api: {
      useUtils: () => ({}),
      countries: { getGlobalStats: query(undefined), getByIdAtTime: query(undefined) },
      thinkpages: { getMyAccounts: query([]) },
      users: { getProfile: query(null) },
    },
  };
});
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null, isSignedIn: false }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/dashboard/sections/UnifiedFeedContent", () => ({
  UnifiedFeedContent: () => <div>feed</div>,
  FollowingFeedContent: () => null,
}));
jest.mock("~/components/dashboard/sections/TrendingFeedContent", () => ({
  TrendingFeedContent: () => null,
}));
jest.mock("~/components/dashboard/sections/TrendingSectionWidget", () => ({
  TrendingSectionWidget: () => <div>trending widget</div>,
}));
jest.mock("~/components/dashboard/sections/BlurbSection", () => ({ BlurbSection: () => null }));
jest.mock("~/components/dashboard/sections/CountriesToExploreCard", () => ({
  CountriesToExploreCard: () => null,
}));

const stats = { economicTierDistribution: { Strong: 3 } };

describe("UnifiedDashboardSection", () => {
  it("shows the right column as an Inspector aside at 1280px and up", () => {
    wide = true;
    render(<UnifiedDashboardSection globalStats={stats} />);
    const aside = screen.getByRole("complementary", { name: "Around IxStates" });
    expect(aside).toHaveTextContent("trending widget");
    expect(aside).toHaveTextContent("Economic tiers");
  });

  it("keeps the fixed aside out of the animated (transformed) wrappers", () => {
    wide = true;
    const { container } = render(<UnifiedDashboardSection globalStats={stats} />);
    const aside = screen.getByRole("complementary", { name: "Around IxStates" });
    // Not inside a flex column laid out for it: the shell reserves its gutter instead.
    expect(aside.parentElement).toBe(container);
    // A transformed ancestor becomes the containing block of a fixed element and would make the
    // aside jump when the entrance animation ends; motion writes its values as inline styles.
    expect(aside.closest("[style]")).toBeNull();
  });

  it("opens the same content in a sheet from the Trends button below 1280px", () => {
    wide = false;
    render(<UnifiedDashboardSection globalStats={stats} />);
    // The aside is in the page from the first paint (CSS shows it from xl); no sheet until asked.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trends" }));
    expect(screen.getByRole("dialog", { name: "Around IxStates" })).toHaveTextContent(
      "trending widget"
    );
    expect(screen.getAllByText("trending widget")).toHaveLength(1);
  });
});
