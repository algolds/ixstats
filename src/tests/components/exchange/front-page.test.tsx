/**
 * The Exchange front page (mockup B): the wordmark, the realm index, Today in business, movers and nation bonds, each
 * linking its own page; an empty realm still renders.
 */
import { render, screen } from "@testing-library/react";
import type { FrontPage as FrontPageData } from "~/lib/exchange/terminal";

let mockData: FrontPageData | undefined;
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/exchange",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => "default" }));
jest.mock("~/trpc/react", () => ({
  api: {
    exchange: {
      frontPage: { useQuery: () => ({ data: mockData, isLoading: false, error: null }) },
      getOverview: { useQuery: () => ({ data: undefined }) },
    },
  },
}));
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import { FrontPage } from "~/components/exchange/terminal/FrontPage";

const empty: FrontPageData = {
  realm: { id: "default", name: "Ixnay" },
  index: { value: 1000, changePct: null, series: [] },
  sectors: [],
  movers: [],
  bonds: [],
  news: [],
  activity: [],
};

const story = {
  id: "n1",
  realmId: "default",
  kind: "dividend",
  prominence: "HEADLINE",
  sourceKind: "COMPANY",
  sourceId: "c1",
  sourceName: "Caphirian Steel",
  headline: "Caphirian Steel pays a ₷500 dividend",
  body: null,
  companyId: "c1",
  bondId: null,
  countryId: null,
  contractId: null,
  movePct: 4.8,
  createdAt: new Date(),
};

describe("FrontPage", () => {
  it("shows the index, the stories and the movers, each linking its page", () => {
    mockData = {
      ...empty,
      index: {
        value: 1284.62,
        changePct: 1.2,
        series: [
          { t: 1, value: 1270 },
          { t: 2, value: 1284.62 },
        ],
      },
      movers: [{ companyId: "c1", name: "Caphirian Steel", price: 42.1, changePct: 4.8 }],
      news: [story],
    };
    render(<FrontPage realmId="default" />);
    expect(screen.getByText("1,284.62")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today in business" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pays a ₷500 dividend/ })).toHaveAttribute(
      "href",
      "/exchange/s/n1"
    );
    expect(document.querySelector('a[href="/exchange/c/c1"]')).not.toBeNull();
  });

  it("renders an empty realm at 1,000.00 with empty states", () => {
    mockData = empty;
    const { container } = render(<FrontPage realmId="default" />);
    expect(screen.getByText("1,000.00")).toBeInTheDocument();
    expect(screen.getByText("No stories yet")).toBeInTheDocument();
    expect(screen.getByText("No bonds on the board yet")).toBeInTheDocument();
    expect(container.querySelector(".uppercase")).toBeNull();
  });
});
