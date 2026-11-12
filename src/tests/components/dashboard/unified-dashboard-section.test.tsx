/**
 * Dashboard feed toolbar: keeps the "Activity" heading screen-reader-only (no visible subtitle),
 * right-aligns a compact icon-free All activity / Following SegmentedControl and the Around IxStates
 * trigger above the stream, and applies Halo top-offset only when no hero card sits above the column.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { UnifiedDashboardSection } from "~/components/dashboard/sections/UnifiedDashboardSection";

let mockAuthState = {
  user: { id: "user-1" } as { id: string } | null,
  isSignedIn: true,
};

jest.mock("~/context/auth-context", () => ({
  useUser: () => mockAuthState,
}));

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      activities: {
        getGlobalFeed: { refetch: jest.fn() },
        getFollowingFeed: { refetch: jest.fn() },
      },
    }),
    users: {
      getProfile: { useQuery: () => ({ data: { countryId: "country-1" } }) },
    },
    countries: {
      getByIdAtTime: {
        useQuery: () => ({
          data: { id: "country-1", name: "Caphiria", newStats: { name: "Caphiria" } },
        }),
      },
      getGlobalStats: { useQuery: () => ({ data: undefined }) },
    },
    thinkpages: {
      getMyAccounts: { useQuery: () => ({ data: [] }) },
    },
  },
}));

jest.mock("~/components/thinkpages/GlassCanvasComposer", () => ({
  GlassCanvasComposer: () => <div data-testid="composer">Composer</div>,
}));

jest.mock("~/components/dashboard/accounts/AccountManagerModal", () => ({
  AccountManagerModal: () => null,
}));

jest.mock("~/components/dashboard/sections/UnifiedFeedContent", () => ({
  UnifiedFeedContent: () => <div data-testid="global-feed">Global stream</div>,
  FollowingFeedContent: () => <div data-testid="following-feed">Following stream</div>,
}));

jest.mock("~/components/dashboard/sections/YourRealmPanel", () => ({
  YourRealmPanel: () => <div>Your realm</div>,
}));

jest.mock("~/components/dashboard/sections/BlurbSection", () => ({
  DailyBlurbCard: () => <div>Daily blurb</div>,
}));

jest.mock("~/components/dashboard/sections/CountriesToExploreCard", () => ({
  CountriesToExploreCard: () => <div>Explore</div>,
}));

jest.mock("~/components/ui/inspector", () => ({
  Inspector: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <aside aria-label={title}>{children}</aside>
  ),
}));

describe("UnifiedDashboardSection", () => {
  beforeEach(() => {
    mockAuthState = { user: { id: "user-1" }, isSignedIn: true };
  });

  it("keeps the Activity heading sr-only and right-aligns an icon-free compact All activity / Following tablist", async () => {
    render(<UnifiedDashboardSection heroVisible />);
    await screen.findByTestId("composer");

    const heading = screen.getByRole("heading", { level: 2, name: "Activity" });
    expect(heading).toHaveClass("sr-only");

    const region = screen.getByRole("region", { name: "Activity" });
    const tablist = screen.getByRole("tablist", { name: "Activity feed" });
    expect(region).toContainElement(tablist);

    const allTab = screen.getByRole("tab", { name: "All activity" });
    const followingTab = screen.getByRole("tab", { name: "Following" });
    expect(allTab.querySelector("svg")).toBeNull();
    expect(followingTab.querySelector("svg")).toBeNull();
    expect(allTab).toHaveAttribute("aria-selected", "true");

    const initialPanel = screen.getByRole("tabpanel");
    expect(allTab).toHaveAttribute("aria-controls", initialPanel.id);
    expect(screen.getByTestId("global-feed")).toBeInTheDocument();

    fireEvent.mouseDown(followingTab);
    fireEvent.click(followingTab);
    expect(followingTab).toHaveAttribute("aria-selected", "true");
    const nextPanel = screen.getByRole("tabpanel");
    expect(followingTab).toHaveAttribute("aria-controls", nextPanel.id);
    expect(screen.getByTestId("following-feed")).toBeInTheDocument();
  });

  it("hides the feed switcher when signed out while keeping the sr-only heading and Inspector trigger", () => {
    mockAuthState = { user: null, isSignedIn: false };
    render(<UnifiedDashboardSection />);

    expect(screen.getByRole("heading", { level: 2, name: "Activity" })).toHaveClass("sr-only");
    expect(screen.queryByRole("tablist", { name: "Activity feed" })).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(screen.getByRole("button", { name: "Around IxStates" })).toBeInTheDocument();
    expect(screen.getByTestId("global-feed")).toBeInTheDocument();
  });

  it("applies the Halo top clearance only when no hero card is visible above the column", async () => {
    const { container, rerender } = render(<UnifiedDashboardSection heroVisible />);
    await screen.findByTestId("composer");
    const haloOffsetClass = "lg:pt-[calc(var(--shell-top-offset)-var(--shell-page-top))]";

    expect(container.innerHTML).not.toContain(haloOffsetClass);

    rerender(<UnifiedDashboardSection heroVisible={false} />);
    expect(container.innerHTML).toContain(haloOffsetClass);
  });
});
