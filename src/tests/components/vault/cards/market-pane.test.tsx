import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      cardMarket: {
        getActiveAuctions: { invalidate: jest.fn() },
        getMyActiveAuctions: { invalidate: jest.fn() },
      },
      cards: { listMine: { invalidate: jest.fn() } },
    }),
    cards: {
      exploreShelves: { useQuery: jest.fn(() => ({ data: [] })) },
      listMine: { useQuery: jest.fn(() => ({ data: undefined, isLoading: true })) },
    },
    cardMarket: {
      getActiveAuctions: { useQuery: jest.fn() },
      getMyActiveAuctions: {
        useQuery: jest.fn(() => ({ data: { auctions: [] }, isLoading: false })),
      },
      getMyActiveBids: { useQuery: jest.fn(() => ({ data: { auctions: [] }, isLoading: false })) },
      getMyAuctionParticipation: { useQuery: jest.fn(() => ({ data: { auctions: [] } })) },
      cancelAuction: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
      createAuction: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
    },
    trading: {
      getActiveTrades: { useQuery: jest.fn(() => ({ data: [], refetch: jest.fn() })) },
      getTradeHistory: { useQuery: jest.fn(() => ({ data: { trades: [] } })) },
    },
  },
}));
jest.mock("~/hooks/marketplace/useAuctionBid", () => ({
  useAuctionBid: jest.fn(() => ({
    placeBid: jest.fn(),
    executeBuyout: jest.fn(),
    isBidding: false,
    isBuyingOut: false,
    error: null,
  })),
}));
jest.mock("~/hooks/marketplace/useAuctionWebSocket", () => ({ useAuctionWebSocket: jest.fn() }));
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "clerk_me" }) }));
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));
jest.mock("~/components/cards/trading/TradeNegotiation", () => ({
  TradeNegotiation: ({ tradeId, isRecipient }: { tradeId: string; isRecipient: boolean }) => (
    <p>
      Offer {tradeId}, {isRecipient ? "to you" : "from you"}
    </p>
  ),
}));
jest.mock("~/components/vault/cards/market/CreateAuctionModal", () => ({
  CreateAuctionModal: ({
    open,
    initialOwnershipId,
  }: {
    open: boolean;
    initialOwnershipId?: string | null;
  }) => (open ? <div role="dialog">Selling {initialOwnershipId ?? "a card"}</div> : null),
}));

import { api } from "~/trpc/react";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";
import { MarketPane } from "~/components/vault/cards/market/MarketPane";
import type { MarketTab } from "~/lib/cards/hub-routes";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = {
  cardId: "c1",
  title: "Caphiria",
  rarity: "EPIC" as const,
  cardType: "LORE" as const,
  realm,
  artwork: "https://art/c1.png",
  silhouette: false,
  number: 1,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o1", finish: "STANDARD" as const, serialNumber: 1, level: 1 },
};
const HOUR = 3_600_000;
const auction = {
  id: "a1",
  cardInstanceId: "o1",
  currentBid: 100,
  startingPrice: 50,
  buyoutPrice: 500,
  // A little over 3 hours, so the rows still read "3h 0m" a few milliseconds later.
  endTime: new Date(Date.now() + 3 * HOUR + 30_000),
  bidCount: 2,
  isMine: false,
  face,
};

function renderPane(
  tab: MarketTab,
  overrides: Partial<React.ComponentProps<typeof MarketPane>> = {}
) {
  const props = {
    tab,
    onTabChange: jest.fn(),
    forCardId: null,
    onClearFor: jest.fn(),
    sellOwnershipId: null,
    onSellHandled: jest.fn(),
    onOpenCard: jest.fn(),
    ...overrides,
  };
  const view = render(<MarketPane {...props} />);
  return { ...props, rerender: () => view.rerender(<MarketPane {...props} />) };
}

const lastAuctionQuery = () =>
  jest.mocked(api.cardMarket.getActiveAuctions.useQuery).mock.calls.at(-1)?.[0];
const listingsAt = (overrides: Partial<typeof auction>, extra: object = {}) =>
  jest.mocked(api.cardMarket.getActiveAuctions.useQuery).mockReturnValue({
    data: { auctions: [{ ...auction, ...overrides }], total: 1, hasMore: false },
    isLoading: false,
    ...extra,
  } as never);

beforeEach(() => {
  jest.mocked(api.cardMarket.getActiveAuctions.useQuery).mockReturnValue({
    data: { auctions: [auction], total: 1, hasMore: false },
    isLoading: false,
  } as never);
});

describe("MarketPane", () => {
  it("has the four sub-tabs and no success-rate tile", () => {
    renderPane("browse");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Browse",
      "Trades",
      "Wishlist",
      "Selling",
    ]);
    expect(screen.queryByText(/Success rate/i)).toBeNull();
  });

  it("browses live auctions as faces, ending soon first, and bids", () => {
    const placeBid = jest.fn();
    jest.mocked(useAuctionBid).mockReturnValue({
      placeBid,
      executeBuyout: jest.fn(),
      isBidding: false,
      isBuyingOut: false,
      error: null,
    });
    const props = renderPane("browse");
    expect(lastAuctionQuery()).toMatchObject({ sortBy: "ending_soon" });
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(props.onOpenCard).toHaveBeenCalledWith("c1");
    expect(screen.getByText("2 bids · 3h 0m left")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bid 105 IxC" }));
    expect(placeBid).toHaveBeenCalledWith("a1", 105);
  });

  it("bids the minimum for a typed bid below it, so a rise never leaves Bid stuck, and buys outright", () => {
    const placeBid = jest.fn();
    const executeBuyout = jest.fn();
    jest.mocked(useAuctionBid).mockReturnValue({
      placeBid,
      executeBuyout,
      isBidding: false,
      isBuyingOut: false,
      error: null,
    });
    const pane = renderPane("browse");
    const amount = screen.getByLabelText("Bid, now 100 IxC");
    fireEvent.change(amount, { target: { value: "104" } });
    fireEvent.click(screen.getByRole("button", { name: "Bid 105 IxC" }));
    expect(placeBid).toHaveBeenLastCalledWith("a1", 105);
    fireEvent.change(amount, { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Bid 120 IxC" }));
    expect(placeBid).toHaveBeenLastCalledWith("a1", 120);
    // Someone outbids the typed 120: the floor rises to 137 and Bid follows it.
    listingsAt({ currentBid: 130 });
    pane.rerender();
    expect(screen.getByLabelText("Bid, now 130 IxC")).toHaveValue(120);
    fireEvent.click(screen.getByRole("button", { name: "Bid 137 IxC" }));
    expect(placeBid).toHaveBeenLastCalledWith("a1", 137);
    fireEvent.change(amount, { target: { value: "150.5" } });
    expect(screen.getByRole("button", { name: /^Bid / })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Buy now for 500 IxC" }));
    expect(executeBuyout).toHaveBeenCalledWith("a1");
  });

  it("shows the player's own listing without bid controls, and points to Selling", () => {
    listingsAt({ isMine: true });
    const props = renderPane("browse");
    expect(screen.getByText("Your listing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Bid / })).toBeNull();
    expect(screen.queryByRole("button", { name: /Buy now/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See it in Selling" }));
    expect(props.onTabChange).toHaveBeenCalledWith("selling");
  });

  it("narrows Browse to one card from the sheet's link, and lets the player see everything again", () => {
    const props = renderPane("browse", { forCardId: "c1" });
    expect(lastAuctionQuery()).toMatchObject({ cardId: "c1" });
    fireEvent.click(screen.getByRole("button", { name: "Show every listing" }));
    expect(props.onClearFor).toHaveBeenCalled();
  });

  it("shows more listings a page at a time, up to the router's cap", () => {
    jest.mocked(api.cardMarket.getActiveAuctions.useQuery).mockReturnValue({
      data: { auctions: [auction], total: 300, hasMore: true },
      isLoading: false,
    } as never);
    renderPane("browse");
    expect(lastAuctionQuery()).toMatchObject({ limit: 20, cardId: undefined });
    for (let page = 0; page < 4; page += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    }
    expect(lastAuctionQuery()).toMatchObject({ limit: 100 });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("keeps the listings on screen while the next page loads", () => {
    const previous = { auctions: [auction], total: 300, hasMore: true };
    listingsAt({}, { data: previous, isPlaceholderData: true });
    renderPane("browse");
    const options = jest.mocked(api.cardMarket.getActiveAuctions.useQuery).mock.calls.at(-1)?.[1];
    const keep = options?.placeholderData;
    expect(typeof keep === "function" && keep(previous as never, undefined)).toBe(previous);
    expect(screen.getByRole("list", { name: "Listings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show more" })).toBeDisabled();
  });

  it("listens for live market events once, on every tab", () => {
    jest.mocked(useAuctionWebSocket).mockClear();
    renderPane("browse");
    expect(useAuctionWebSocket).toHaveBeenCalledTimes(1);
    jest.mocked(useAuctionWebSocket).mockClear();
    renderPane("selling");
    expect(useAuctionWebSocket).toHaveBeenCalledTimes(1);
  });

  it("says when nothing is listed, and offers to sell", () => {
    jest.mocked(api.cardMarket.getActiveAuctions.useQuery).mockReturnValue({
      data: { auctions: [], total: 0, hasMore: false },
      isLoading: false,
    } as never);
    renderPane("browse");
    expect(screen.getByText("Nothing is listed right now")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Sell a card" })[0]!);
    expect(screen.getByRole("dialog")).toHaveTextContent("Selling a card");
  });

  it("opens the auction form for the copy the sheet sent", () => {
    renderPane("selling", { sellOwnershipId: "o7" });
    expect(screen.getByRole("dialog")).toHaveTextContent("Selling o7");
  });

  it("lists the player's listings and bids; a listing with bids cannot be cancelled", () => {
    const cancel = jest.fn();
    jest.mocked(api.cardMarket.cancelAuction.useMutation).mockReturnValue({
      mutate: cancel,
      isPending: false,
    } as never);
    jest.mocked(api.cardMarket.getMyActiveAuctions.useQuery).mockReturnValue({
      data: {
        auctions: [
          { ...auction, id: "mine-open", bidCount: 0, currentBid: 0 },
          { ...auction, id: "mine-ended", endTime: new Date(Date.now() - HOUR) },
        ],
      },
      isLoading: false,
    } as never);
    jest.mocked(api.cardMarket.getMyActiveBids.useQuery).mockReturnValue({
      data: { auctions: [{ ...auction, id: "bid-1" }] },
      isLoading: false,
    } as never);
    renderPane("selling");
    const listings = within(screen.getByRole("region", { name: "Your listings" }));
    expect(listings.getByText("50 IxC · 0 bids · 3h 0m left")).toBeInTheDocument();
    expect(listings.getByText("100 IxC · 2 bids · Ended")).toBeInTheDocument();
    const [open, ended] = listings.getAllByRole("button", { name: "Cancel" });
    expect(ended).toBeDisabled();
    expect(ended).toHaveAccessibleDescription("Has bids, so it cannot be cancelled");
    expect(listings.getAllByText("Has bids, so it cannot be cancelled")).toHaveLength(1);
    fireEvent.click(open!);
    expect(cancel).toHaveBeenCalledWith({ auctionId: "mine-open" });
    const bids = within(screen.getByRole("region", { name: "Your bids" }));
    expect(bids.getByText("100 IxC · 3h 0m left")).toBeInTheDocument();
  });

  it("splits open offers into the ones to the player and the ones they sent", () => {
    jest.mocked(api.trading.getActiveTrades.useQuery).mockReturnValue({
      data: [
        {
          id: "t1",
          initiator: { clerkUserId: "clerk_ann" },
          recipient: { clerkUserId: "clerk_me" },
        },
        {
          id: "t2",
          initiator: { clerkUserId: "clerk_me" },
          recipient: { clerkUserId: "clerk_ann" },
        },
      ],
      refetch: jest.fn(),
    } as never);
    renderPane("trades");
    const incoming = screen.getByRole("tab", { name: /^Incoming\s*, 1 offer$/ });
    const panel = screen.getByRole("tabpanel", { name: "Incoming" });
    expect(incoming).toHaveAttribute("aria-controls", panel.id);
    expect(within(panel).getByText("Offer t1, to you")).toBeInTheDocument();
    expect(screen.queryByText(/Offer t2/)).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Sent\s*, 1 offer$/ }));
    expect(
      within(screen.getByRole("tabpanel", { name: "Sent" })).getByText("Offer t2, from you")
    ).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("No trades or auctions yet")).toBeInTheDocument();
  });

  it("keeps a place for the wishlist", () => {
    const props = renderPane("wishlist");
    expect(screen.getByText("Wishlists are not open yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
    expect(props.onTabChange).toHaveBeenCalledWith("browse");
  });
});
