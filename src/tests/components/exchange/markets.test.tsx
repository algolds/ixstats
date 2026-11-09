/**
 * Markets: companies, bonds and funds, filtered by `?kind=` and `?q=`, each row linking its page, with a watch star
 * that asks a signed-out visitor to sign in.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { keepPreviousData } from "@tanstack/react-query";
import type { MarketRow } from "~/lib/exchange/terminal";

const mockReplace = jest.fn();
let mockParams = new URLSearchParams("kind=bonds");
let mockSignedIn = false;
let mockRows: MarketRow[] = [];
const mockMarkets = jest.fn();
const mockMarketsOpts = jest.fn();
const mockSetModifier = jest.fn();
let mockCanManage = false;

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
      getOverview: {
        useQuery: () => ({
          data: { realmId: "default", nations: [], canManageRealm: mockCanManage },
        }),
      },
      getSectors: {
        useQuery: () => ({
          data: [
            { sectorKey: "industry", label: "Industry", dmModifier: 0 },
            { sectorKey: "services", label: "Services", dmModifier: 0.25 },
          ],
        }),
      },
      setSectorDmModifier: {
        useMutation: () => ({ mutate: mockSetModifier, isPending: false }),
      },
      markets: {
        useQuery: (input: unknown, opts?: unknown) => {
          mockMarkets(input);
          mockMarketsOpts(opts);
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
  mockMarketsOpts.mockReset();
  mockSetModifier.mockReset();
  mockCanManage = false;
});

describe("sector levers", () => {
  it("lets a realm manager set a sector's demand modifier from the funds view", () => {
    mockParams = new URLSearchParams("kind=funds");
    mockCanManage = true;
    render(<MarketsPage realmId="default" />);
    expect(screen.getByRole("heading", { name: "Sector levers" })).toBeInTheDocument();
    expect(screen.getByLabelText("Services modifier")).toHaveValue(0.25);
    fireEvent.change(screen.getByLabelText("Industry modifier"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Set Industry" }));
    expect(mockSetModifier).toHaveBeenCalledWith({
      realmId: "default",
      sectorKey: "industry",
      value: 0.5,
    });
  });

  it("is hidden from everyone else", () => {
    mockParams = new URLSearchParams("kind=funds");
    render(<MarketsPage realmId="default" />);
    expect(screen.queryByRole("heading", { name: "Sector levers" })).not.toBeInTheDocument();
  });
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

  it("lets a fund be traded from its row", () => {
    mockParams = new URLSearchParams("kind=funds");
    mockRows = [
      {
        kind: "funds",
        id: "industry",
        name: "Industry fund",
        subtitle: "Sector index fund",
        price: 1.25,
        changePct: null,
        sectorKey: "industry",
      },
    ];
    render(<MarketsPage realmId="default" />);
    expect(screen.getByRole("button", { name: "Trade" })).toBeInTheDocument();
  });

  it("debounces search input by 250 ms before writing to the address and keeps previous data", () => {
    jest.useFakeTimers();
    try {
      mockParams = new URLSearchParams("kind=companies");
      mockRows = [];
      render(<MarketsPage realmId="default" />);
      expect(mockMarketsOpts).toHaveBeenCalledWith(
        expect.objectContaining({ placeholderData: keepPreviousData })
      );
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "st" } });
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "steel" } });
      expect(mockReplace).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenLastCalledWith("/exchange/markets?kind=companies&q=steel", {
        scroll: false,
      });
    } finally {
      jest.useRealTimers();
    }
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
