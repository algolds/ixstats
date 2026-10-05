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

  it("opens the same content in a sheet from the Trends button below 1280px", () => {
    wide = false;
    render(<UnifiedDashboardSection globalStats={stats} />);
    expect(screen.queryByText("trending widget")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trends" }));
    expect(screen.getByRole("dialog", { name: "Around IxStates" })).toHaveTextContent(
      "trending widget"
    );
  });
});
