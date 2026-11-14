/**
 * CardsHub Facet layout: PageHeader with a single primary action per view, natural-width SegmentedControl,
 * compact MarketBrowse Filters popover, and retryable EmptyState on query error.
 */
import { fireEvent, render, screen } from "@testing-library/react";

let mockSearch = "";
const mockNavigate = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/vault/cards/market",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ userId: "user-1", isSignedIn: true, isLoaded: true }),
}));
jest.mock("~/hooks/useCardHubTab", () => ({
  useCardHubTab: (initial: string) => ({ tab: initial, navigate: mockNavigate }),
}));
jest.mock("~/hooks/useCardSheet", () => ({
  useCardSheet: () => ({ open: jest.fn(), close: jest.fn(), cardId: null }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/hooks/marketplace/useAuctionWebSocket", () => ({
  useAuctionWebSocket: () => undefined,
}));
jest.mock("~/hooks/marketplace/useAuctionBid", () => ({
  useAuctionBid: () => ({
    placeBid: jest.fn(),
    buyout: jest.fn(),
    isPlacingBid: false,
    isBuyingOut: false,
  }),
}));
jest.mock("~/components/cards/sheet/economy/BuyListingDialog", () => ({
  BuyListingDialog: () => null,
}));
jest.mock("~/components/vault/cards/market/CreateAuctionModal", () => ({
  CreateAuctionModal: () => null,
}));
jest.mock("~/components/cards/trade/TradeBuilderHost", () => ({
  TradeBuilderHost: () => null,
}));
jest.mock("~/components/vault/cards/ExplorePane", () => ({
  ExplorePane: () => <div data-testid="explore-pane" />,
}));
jest.mock("~/components/vault/cards/MinePane", () => ({
  MinePane: () => <div data-testid="mine-pane" />,
}));
jest.mock("~/components/vault/cards/SetsPane", () => ({
  SetsPane: () => <div data-testid="sets-pane" />,
  NewShowcaseAction: () => <button type="button">New showcase</button>,
}));

let mockListingsError = false;
const mockRefetchListings = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    realms: { directory: { useQuery: () => ({ data: [] }) } },
    cardMarket: {
      browse: {
        useQuery: () => ({
          data: mockListingsError ? undefined : { items: [], total: 0 },
          isLoading: false,
          isError: mockListingsError,
          refetch: mockRefetchListings,
        }),
      },
      getWishlist: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      getMyListings: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
    },
    trading: {
      getActiveTrades: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
    },
    cards: {
      exploreShelves: { useQuery: () => ({ data: { realms: [] } }) },
      getCardById: { useQuery: () => ({ data: undefined }) },
    },
  },
}));

import { CardsHub } from "~/components/vault/cards/CardsHub";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

beforeEach(() => {
  mockSearch = "";
  mockListingsError = false;
  mockNavigate.mockReset();
  mockRefetchListings.mockReset();
});

describe("CardsHub Facet header and controls", () => {
  it("renders PageHeader, top-level tabs, single primary Sell a card action, and compact Filters trigger on Market Browse", () => {
    render(<CardsHub initialTab="market" />);
    expect(screen.getByRole("heading", { level: 1, name: "Cards" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mine" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Market" })).toHaveAttribute("aria-selected", "true");
    const primarySellButtons = screen
      .getAllByRole("button", { name: /sell a card/i })
      .filter((btn) => btn.className.includes("bg-primary-fill"));
    expect(primarySellButtons).toHaveLength(1);
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("switches the PageHeader primary action to New trade on Market Trades and Suggest a card on Explore", () => {
    mockSearch = "tab=trades";
    const { unmount } = render(<CardsHub initialTab="market" />);
    expect(screen.getByRole("link", { name: /new trade/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sell a card/i })).toBeNull();
    unmount();

    mockSearch = "";
    render(<CardsHub initialTab="explore" />);
    expect(screen.getByRole("button", { name: /suggest a card/i })).toBeInTheDocument();
  });

  it("renders a retryable EmptyState when Market Browse listings fail to load", () => {
    mockListingsError = true;
    render(<CardsHub initialTab="market" />);
    expect(screen.getByText("The listings did not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetchListings).toHaveBeenCalledTimes(1);
  });
});
