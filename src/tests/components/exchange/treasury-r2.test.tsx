/**
 * Release 2's Treasury section and trading as the treasury: the wealth fund card moves ₷, the lending form sends
 * fractions, the trade sheet trades as the fund, and the nation page shows the fund's holdings.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const calls: Record<string, jest.Mock> = {
  depositToFund: jest.fn(),
  withdrawFromFund: jest.fn(),
  setLendingTerms: jest.fn(),
  fundTrade: jest.fn(),
  placeBuyOrder: jest.fn(),
};
const portfolio = {
  wallet: 1500,
  shares: [],
  bonds: [{ bondId: "b_nb", name: "Urcea 4-week bond", units: 5, price: 100, value: 500 }],
  funds: [],
  orders: { buyOrders: [], shareListings: [], bondListings: [] },
  watchlist: [],
  votesOwed: [],
  totalValue: 2000,
};
let mockNation: object | undefined;

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: true, isLoaded: true }) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/exchange/treasury",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("~/trpc/react", () => {
  const m = (name: string) => ({
    useMutation: () => ({ mutate: calls[name] ?? jest.fn(), isPending: false, error: null }),
  });
  return {
    api: {
      useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
      exchange: {
        getOverview: {
          useQuery: () => ({
            data: {
              realmId: "default",
              nations: [{ id: "x1", name: "Caphiria", realmId: "default" }],
              realmNations: [
                { id: "x1", name: "Caphiria", lendingSpread: 0, companyCreditCap: 250000 },
              ],
            },
            isLoading: false,
          }),
        },
        nationPage: {
          useQuery: () => ({
            data: mockNation ?? {
              id: "x1",
              name: "Caphiria",
              treasury: {
                balance: 8000,
                cap: 25000,
                lifetimeStipend: 100,
                lifetimeTaxEarned: 50,
                lifetimeTariffEarned: 0,
                lifetimeInterestEarned: 0,
                lifetimeSpent: 0,
              },
              bonds: [],
              rating: "AA",
              fund: portfolio,
            },
            isLoading: false,
          }),
        },
        fundSummary: {
          useQuery: () => ({
            data: { countryId: "x1", cash: 1500, invested: 2000, room: 3000, portfolio },
            isLoading: false,
          }),
        },
        issueBond: m("issueBond"),
        depositToFund: m("depositToFund"),
        withdrawFromFund: m("withdrawFromFund"),
        setLendingTerms: m("setLendingTerms"),
        fundTrade: m("fundTrade"),
        placeBuyOrder: m("placeBuyOrder"),
        listShares: m("listShares"),
        toggleWatch: m("toggleWatch"),
      },
    },
  };
});

import { NationPage } from "~/components/exchange/terminal/NationPage";
import { TradeSheet } from "~/components/exchange/terminal/TradeSheet";
import { TreasuryPage } from "~/components/exchange/terminal/TreasuryPage";

beforeEach(() => {
  for (const c of Object.values(calls)) c.mockReset();
  mockNation = undefined;
});

describe("the Treasury section", () => {
  it("moves ₷ into the wealth fund", () => {
    render(<TreasuryPage realmId="default" />);
    expect(screen.getByRole("heading", { name: "Wealth fund" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount to move"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Move into the fund" }));
    expect(calls.depositToFund).toHaveBeenCalledWith(
      expect.objectContaining({ countryId: "x1", amount: 500, requestId: expect.any(String) }),
      expect.anything()
    );
  });

  it("sends lending terms as fractions", () => {
    render(<TreasuryPage realmId="default" />);
    fireEvent.change(screen.getByLabelText("Extra spread (%)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Credit cap per company"), {
      target: { value: "100000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save lending terms" }));
    expect(calls.setLendingTerms).toHaveBeenCalledWith(
      { countryId: "x1", spread: 0.03, cap: 100000 },
      expect.anything()
    );
  });
});

describe("trading as the treasury", () => {
  it("offers the switch and buys through the fund", () => {
    render(
      <TradeSheet
        instrument={{
          kind: "share",
          companyId: "c2",
          name: "Bob Steel",
          price: 11,
          bestAsk: 12,
          bestBid: 10,
        }}
        treasury={{ countryId: "x1", name: "Caphiria" }}
        open
        onOpenChange={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Caphiria Treasury" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(calls.fundTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        countryId: "x1",
        order: { kind: "shares-buy", companyId: "c2", shares: 10, maxPricePerShare: 12 },
      }),
      expect.anything()
    );
    expect(calls.placeBuyOrder).not.toHaveBeenCalled();
  });
});

describe("the nation page", () => {
  it("shows the wealth fund's holdings", () => {
    mockNation = {
      id: "x1",
      name: "Caphiria",
      flagUrl: null,
      realmId: "default",
      currency: null,
      currencySymbol: null,
      currencyRate: null,
      rating: "AA",
      treasury: { balance: 8000, cap: 25000, recent: [] },
      bonds: [],
      companies: [],
      news: [],
      viewer: { watching: false },
      fund: portfolio,
    };
    render(<NationPage countryId="x1" />);
    expect(screen.getByRole("heading", { name: "Wealth fund" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Urcea 4-week bond/ })).toHaveAttribute(
      "href",
      "/exchange/b/b_nb"
    );
  });
});
