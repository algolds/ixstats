/** Portfolio and Treasury: votes owed link the company, the bond form sends a fraction coupon, a non-owner is told why. */
import { fireEvent, render, screen } from "@testing-library/react";

let mockPortfolio: object | undefined;
let mockOverview: object | undefined;
const mockIssue = jest.fn();

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: true, isLoaded: true }) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/exchange/portfolio",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("~/trpc/react", () => {
  const idle = { useMutation: () => ({ mutate: jest.fn(), isPending: false, error: null }) };
  return {
    api: {
      useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
      exchange: {
        portfolio: { useQuery: () => ({ data: mockPortfolio, isLoading: false }) },
        getOverview: { useQuery: () => ({ data: mockOverview, isLoading: false }) },
        nationPage: {
          useQuery: () => ({
            data: {
              id: "x1",
              name: "Caphiria",
              treasury: { balance: 5000, cap: 25000 },
              bonds: [],
              rating: "AA",
            },
            isLoading: false,
          }),
        },
        issueBond: { useMutation: () => ({ mutate: mockIssue, isPending: false, error: null }) },
        cancelBuyOrder: idle,
        cancelShareListing: idle,
        cancelBondListing: idle,
        toggleWatch: idle,
      },
    },
  };
});

import { PortfolioPage } from "~/components/exchange/terminal/PortfolioPage";
import { TreasuryPage } from "~/components/exchange/terminal/TreasuryPage";

describe("PortfolioPage", () => {
  it("links each vote owed to its company", () => {
    mockPortfolio = {
      wallet: 300,
      shares: [],
      bonds: [],
      funds: [],
      orders: { buyOrders: [], shareListings: [], bondListings: [] },
      watchlist: [],
      votesOwed: [
        { proposalId: "p1", companyId: "c1", companyName: "Caphirian Steel", type: "DISSOLVE" },
      ],
      totalValue: 300,
    };
    render(<PortfolioPage realmId="default" />);
    expect(screen.getByRole("link", { name: /Caphirian Steel/ })).toHaveAttribute(
      "href",
      "/exchange/c/c1"
    );
  });
});

describe("TreasuryPage", () => {
  it("issues bonds with the coupon as a fraction", () => {
    mockOverview = {
      realmId: "default",
      nations: [{ id: "x1", name: "Caphiria", realmId: "default" }],
    };
    render(<TreasuryPage realmId="default" />);
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Coupon (%)"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Term (weeks)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Issue bonds" }));
    expect(mockIssue).toHaveBeenCalledWith(
      expect.objectContaining({ countryId: "x1", units: 100, couponRate: 0.05, termWeeks: 4 }),
      expect.anything()
    );
  });

  it("tells a non-owner the Treasury is for a nation's owner", () => {
    mockOverview = { realmId: "default", nations: [] };
    render(<TreasuryPage realmId="default" />);
    expect(screen.getByText("The Treasury is for a nation's owner.")).toBeInTheDocument();
  });
});
