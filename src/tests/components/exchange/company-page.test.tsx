/** A company's page: who it is, its price and chart, its nation, and the order book under Advanced. */
import { fireEvent, render, screen } from "@testing-library/react";

let mockPage: object | undefined;
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: false, isLoaded: true }) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/exchange/c/c1",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
    exchange: {
      getOverview: { useQuery: () => ({ data: undefined }) },
      companyPage: { useQuery: () => ({ data: mockPage, isLoading: false, error: null }) },
      toggleWatch: { useMutation: () => ({ mutate: jest.fn() }) },
      castVote: { useMutation: () => ({ mutate: jest.fn() }) },
    },
  },
}));

import { CompanyPage } from "~/components/exchange/terminal/CompanyPage";

beforeEach(() => {
  mockPage = {
    company: {
      id: "c1",
      name: "Caphirian Steel",
      ticker: "CS",
      sectorLabel: "Industry",
      subIndustryLabel: "Heavy Manufacturing & Defense",
      status: "ACTIVE",
      creditRating: "A",
      tradingOpen: true,
      lastTickRevenue: 10,
      lastTickExpenses: 4,
      lastTickTax: 1,
      lastTickNetIncome: 5,
      wikiData: null,
    },
    price: 42.1,
    changePct: 4.8,
    metrics: {
      marketCap: 42100,
      bookValue: 1000,
      eps: 1,
      peRatio: 42.1,
      dividendYield: null,
      debtToEquity: 0,
    },
    valueHistory: [],
    hq: { id: "x1", name: "Caphiria" },
    shareholders: [{ label: "Founder", shares: 1000, stake: 1 }],
    orderBook: {
      bids: [{ price: 40, shares: 5, orders: 1 }],
      asks: [{ price: 43, shares: 7, listings: 1 }],
      lastTradePrice: 42.1,
    },
    dividends: [],
    decisions: [],
    proposals: [],
    news: [],
    viewer: { watching: false, shares: 0, founded: false },
  };
});

describe("CompanyPage", () => {
  it("shows the name, ticker, price and a link to its nation", () => {
    render(<CompanyPage companyId="c1" />);
    expect(screen.getByRole("heading", { level: 1, name: /Caphirian Steel/ })).toBeInTheDocument();
    expect(screen.getByText("CS")).toBeInTheDocument();
    expect(screen.getByText("₷42.10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Caphiria" })).toHaveAttribute(
      "href",
      "/exchange/n/x1"
    );
  });

  it("leaves out the change line until there is a change", () => {
    mockPage = { ...mockPage, changePct: null };
    render(<CompanyPage companyId="c1" />);
    expect(screen.queryByText("over a day")).toBeNull();
  });

  it("opens the order book under Advanced", () => {
    render(<CompanyPage companyId="c1" />);
    expect(screen.queryByText("Bids")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    expect(screen.getByText("Bids")).toBeInTheDocument();
    expect(screen.getByText("Asks")).toBeInTheDocument();
  });
});
