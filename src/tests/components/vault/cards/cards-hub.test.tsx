/**
 * CardsHub per-route PageHeader archetypes + in-page Facet SegmentedControl (`My cards | Sets | Market | Explore`),
 * `Import deck` link, and inline MarketPane mode pills.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

let mockSearch = "";
let mockActiveTrades: Array<{ id: string; myTurn: boolean }> = [];
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
jest.mock("~/hooks/useCardsRefresh", () => ({
  useCardsRefresh: () => jest.fn(),
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
    executeBuyout: jest.fn(),
    isBidding: false,
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
    useUtils: () => ({
      cardMarket: {
        getMyListings: { invalidate: jest.fn() },
        getWishlist: { invalidate: jest.fn() },
      },
      cards: {
        getSheetEconomy: { invalidate: jest.fn() },
        getSheet: { invalidate: jest.fn() },
      },
    }),
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
      getMyActiveAuctions: {
        useQuery: () => ({ data: { auctions: [] }, isLoading: false, isError: false }),
      },
      getMyActiveBids: {
        useQuery: () => ({ data: { auctions: [] }, isLoading: false, isError: false }),
      },
      cancelListing: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      cancelAuction: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      removeFromWishlist: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
    trading: {
      getActiveTrades: {
        useQuery: () => ({ data: mockActiveTrades, isLoading: false, isError: false }),
      },
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
  mockActiveTrades = [];
  mockListingsError = false;
  mockNavigate.mockReset();
  mockRefetchListings.mockReset();
  window.history.replaceState(null, "", "/vault/cards/market");
});

describe("CardsHub per-route PageHeader identity and in-page SegmentedControl", () => {
  it("renders route-specific headers, in-page Cards views SegmentedControl, and Import deck link", () => {
    const { rerender } = render(<CardsHub initialTab="mine" />);
    expect(screen.getByRole("heading", { level: 1, name: "My cards" })).toBeInTheDocument();
    expect(
      screen.getByText("Your personal binder, showcase pins, and duplicate copies.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get packs" })).toHaveAttribute("href", "/vault/store");
    expect(screen.getByRole("link", { name: "Import deck" })).toHaveAttribute(
      "href",
      "/vault/import"
    );
    expect(screen.getByRole("button", { name: /list a card/i })).toBeInTheDocument();

    const viewsSwitch = screen.getByRole("radiogroup", { name: "Cards views" });
    expect(within(viewsSwitch).getByRole("radio", { name: "My cards" })).toBeChecked();
    fireEvent.click(within(viewsSwitch).getByRole("radio", { name: "Sets" }));
    expect(mockNavigate).toHaveBeenCalledWith("sets");

    rerender(<CardsHub initialTab="sets" />);
    expect(screen.getByRole("heading", { level: 1, name: "Sets" })).toBeInTheDocument();
    expect(
      screen.getByText("Season albums, regional series, and completion progress.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New showcase" })).toBeInTheDocument();

    rerender(<CardsHub initialTab="explore" />);
    expect(screen.getByRole("heading", { level: 1, name: "Explore cards" })).toBeInTheDocument();
    expect(
      screen.getByText("Complete reference index of every card minted across seasons and realms.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /suggest a card/i })).toBeInTheDocument();
  });

  it("renders Card market header, inline ActionPill mode switcher, single primary List a card CTA, and Filters trigger", () => {
    mockActiveTrades = [
      { id: "t-1", myTurn: true },
      { id: "t-2", myTurn: false },
    ];
    render(<CardsHub initialTab="market" />);

    expect(screen.getByRole("heading", { level: 1, name: "Card market" })).toBeInTheDocument();
    expect(
      screen.getByText("Live player auctions, direct card trades, and wishlists.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Vault" })).toBeNull();

    const modeGroup = screen.getByRole("group", { name: "Market mode" });
    expect(within(modeGroup).getByRole("button", { name: "Auctions" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const tradesPill = within(modeGroup).getByRole("button", { name: /trades/i });
    expect(tradesPill).toHaveAttribute("aria-pressed", "false");
    expect(tradesPill).toHaveTextContent("1");
    expect(within(modeGroup).getByRole("button", { name: "Wishlist" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(within(modeGroup).getByRole("button", { name: "My listings" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    const primaryListButtons = screen
      .getAllByRole("button", { name: /list a card/i })
      .filter((btn) => btn.className.includes("bg-primary-fill"));
    expect(primaryListButtons).toHaveLength(1);
    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();

    fireEvent.click(within(modeGroup).getByRole("button", { name: "Wishlist" }));
    expect(window.location.search).toBe("?tab=wishlist");
  });

  it("switches to New trade on Market Trades with zero tablists, and supports Wishlist and My listings modes", () => {
    mockSearch = "tab=trades";
    const { unmount } = render(<CardsHub initialTab="market" />);
    expect(screen.getByRole("link", { name: /new trade/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /list a card/i })).toBeNull();
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /trades/i, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Incoming", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sent", pressed: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History", pressed: false })).toBeInTheDocument();
    unmount();

    mockSearch = "tab=selling";
    render(<CardsHub initialTab="market" />);
    expect(screen.getByRole("button", { name: "My listings", pressed: true })).toBeInTheDocument();
    expect(screen.getByText("No active auctions or bids")).toBeInTheDocument();
  });

  it("renders a retryable EmptyState when Market Browse listings fail to load", () => {
    mockListingsError = true;
    render(<CardsHub initialTab="market" />);
    expect(screen.getByText("The listings did not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetchListings).toHaveBeenCalledTimes(1);
  });
});
