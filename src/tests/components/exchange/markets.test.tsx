/**
 * Markets: companies, bonds and funds, filtered by `?kind=` and `?q=`, each row linking its page, with a watch star
 * that asks a signed-out visitor to sign in.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { MarketRow } from "~/lib/exchange/terminal";

const mockReplace = jest.fn();
let mockParams = new URLSearchParams("kind=bonds");
let mockSignedIn = false;
let mockRows: MarketRow[] = [];
const mockMarkets = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/exchange/markets",
  useSearchParams: () => mockParams,
}));
jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: mockSignedIn, isLoaded: true }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
    exchange: {
      markets: {
        useQuery: (input: unknown) => {
          mockMarkets(input);
          return { data: mockRows, isLoading: false };
        },
      },
      toggleWatch: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

import { MarketsPage } from "~/components/exchange/terminal/MarketsPage";
import { WatchStar } from "~/components/exchange/terminal/WatchStar";

beforeEach(() => {
  mockReplace.mockReset();
  mockMarkets.mockReset();
});

describe("MarketsPage", () => {
  it("lists bonds with their yield, each linking its page", () => {
    mockParams = new URLSearchParams("kind=bonds");
    mockRows = [
      {
        kind: "bonds",
        id: "b1",
        name: "Urcea 5-week bond",
        subtitle: "4.2% coupon",
        price: 100,
        changePct: null,
        couponRate: 0.042,
        yield: 0.042,
        rating: "AA",
        weeksLeft: 5,
        unitsLeft: 10,
      },
    ];
    render(<MarketsPage realmId="default" />);
    expect(mockMarkets).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "bonds", realmId: "default" })
    );
    expect(screen.getByRole("link", { name: /Urcea 5-week bond/ })).toHaveAttribute(
      "href",
      "/exchange/b/b1"
    );
    expect(screen.getByText(/4.20% · AA/)).toBeInTheDocument();
  });

  it("writes the search into the address", () => {
    mockParams = new URLSearchParams("kind=companies");
    mockRows = [];
    render(<MarketsPage realmId="default" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "steel" } });
    expect(mockReplace).toHaveBeenLastCalledWith("/exchange/markets?kind=companies&q=steel", {
      scroll: false,
    });
  });
});

describe("WatchStar", () => {
  it("asks a signed-out visitor to sign in", () => {
    mockSignedIn = false;
    render(<WatchStar subjectKind="COMPANY" subjectId="c1" watching={false} />);
    expect(screen.getByRole("link", { name: "Sign in to watch" }).getAttribute("href")).toMatch(
      /^\/sign-in\?redirect_url=/
    );
  });

  it("is a toggle when signed in", () => {
    mockSignedIn = true;
    render(<WatchStar subjectKind="COMPANY" subjectId="c1" watching />);
    expect(screen.getByRole("button", { name: "Stop watching" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
