import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      exploreShelves: { useQuery: jest.fn(() => ({ data: { realms: [] } })) },
      listMine: { useQuery: jest.fn(() => ({ data: undefined, isLoading: true })) },
    },
    cardMarket: {
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
jest.mock("~/hooks/cards/useMarketTabs", () => ({
  useBrowse: jest.fn(),
  useWishlist: jest.fn(() => ({ data: [], isLoading: false })),
  useMyListings: jest.fn(() => ({ data: [], isLoading: false })),
  useListingActions: jest.fn(() => ({
    cancel: { mutate: jest.fn(), isPending: false },
    removeWish: { mutate: jest.fn(), isPending: false },
  })),
}));
jest.mock("~/hooks/useKeepSelectedInView", () => ({ useKeepSelectedInView: jest.fn() }));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "clerk_me" }) }));
jest.mock("~/components/cards/trade/TradeBuilderHost", () => ({
  TradeBuilderHost: ({ address, onClose }: { address: { trade: string } | null; onClose: () => void }) =>
    address ? <button onClick={onClose}>Close trade {address.trade}</button> : null,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
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
import {
  useBrowse,
  useListingActions,
  useMyListings,
  useWishlist,
} from "~/hooks/cards/useMarketTabs";
import { useKeepSelectedInView } from "~/hooks/useKeepSelectedInView";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { MarketPane } from "~/components/vault/cards/market/MarketPane";
import type { MarketTab } from "~/lib/cards/hub-routes";

const refreshCards = jest.mocked(useCardsRefresh());
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
// A little over 3 hours, so the rows still read "3h 0m" a few milliseconds later.
const ENDS = new Date(Date.now() + 3 * HOUR + 30_000);
const auction = {
  id: "a1",
  cardInstanceId: "o1",
  currentBid: 100,
  startingPrice: 50,
  buyoutPrice: 500,
  endTime: ENDS,
  bidCount: 2,
  isMine: false,
  face,
};
/** The same auction as Browse lists it. */
const browseItem = {
  kind: "auction",
  id: "a1",
  price: 100,
  isFeatured: false,
  endsAt: ENDS,
  createdAt: new Date(),
  isMine: false,
  ownershipId: "o1",
  bidCount: 2,
  buyoutPrice: 500,
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
    trade: null,
    onCloseTrade: jest.fn(),
    ...overrides,
  };
  const view = render(<MarketPane {...props} />);
  return { ...props, rerender: () => view.rerender(<MarketPane {...props} />) };
}

const lastBrowse = () => jest.mocked(useBrowse).mock.calls.at(-1)?.[0];
const browsing = (items: object[], extra: object = {}) =>
  jest.mocked(useBrowse).mockReturnValue({
    data: { items, hasMore: false },
    isLoading: false,
    ...extra,
  } as never);
const listingsAt = (overrides: Partial<typeof browseItem>, extra: object = {}) =>
  browsing([{ ...browseItem, ...overrides }], extra);

beforeEach(() => browsing([browseItem]));

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

  // At 320px the four tabs are wider than the page: the row scrolls inside itself, so the page never pans sideways.
  it("scrolls its tab row in its own track, drawing each focus ring inside the clip", () => {
    renderPane("browse");
    const list = screen.getByRole("tablist", { name: "Market" });
    expect(list).toHaveClass("overflow-x-auto", "hide-scrollbar");
    for (const tab of within(list).getAllByRole("tab")) {
      expect(tab).toHaveClass("focus-visible:-outline-offset-2");
      expect(tab).not.toHaveClass("focus-visible:outline-offset-2");
    }
  });

  // The SegmentedControl's own keep-in-view (useKeepSelectedInView): a selected or focused tab past the edge, or one
  // pushed out when a tab before it widens, scrolls back into the row.
  it("keeps the selected tab in view in its row", () => {
    renderPane("selling");
    const list = screen.getByRole("tablist", { name: "Market" });
    const [ref, options] = jest.mocked(useKeepSelectedInView).mock.calls.at(-1)!;
    expect(ref.current).toBe(list);
    expect(options).toEqual({ enabled: true, selected: "selling" });
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
    expect(lastBrowse()).toMatchObject({ kind: "all", sort: "ending_soon" });
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(props.onOpenCard).toHaveBeenCalledWith("c1");
    expect(screen.getByText("3h 0m left").parentElement).toHaveTextContent("2 bids · 3h 0m left");
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
    listingsAt({ price: 130 });
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

  it("filters by every public realm with cards, not only the realms Explore shelves", () => {
    jest.mocked(api.cards.exploreShelves.useQuery).mockReturnValue({
      data: { realms: [realm, { ...realm, id: "r13", slug: "eurth", name: "Eurth" }] },
    } as never);
    renderPane("browse");
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Every realm",
      "Ixnay",
      "Eurth",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "Eurth" }));
    expect(lastBrowse()).toMatchObject({ filters: { realmId: "r13" } });
  });

  it("narrows Browse to one card from the sheet's link, and lets the player see everything again", () => {
    const props = renderPane("browse", { forCardId: "c1" });
    expect(lastBrowse()).toMatchObject({ filters: { cardId: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: "Show every listing" }));
    expect(props.onClearFor).toHaveBeenCalled();
  });

  it("shows more listings a page at a time, up to the router's cap", () => {
    listingsAt({}, { data: { items: [browseItem], hasMore: true } });
    renderPane("browse");
    expect(lastBrowse()).toMatchObject({ limit: 20, offset: 0, filters: { cardId: undefined } });
    for (let page = 0; page < 4; page += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    }
    expect(lastBrowse()).toMatchObject({ limit: 100 });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("keeps the listings on screen while the next page loads", () => {
    listingsAt({}, { data: { items: [browseItem], hasMore: true }, isPlaceholderData: true });
    renderPane("browse");
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
    browsing([]);
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

  it("puts the player's fixed-price listings first, above their auctions and bids, and cancels one", () => {
    const cancel = jest.fn();
    jest.mocked(useListingActions).mockReturnValue({
      cancel: { mutate: cancel, isPending: false },
      removeWish: { mutate: jest.fn(), isPending: false },
    } as never);
    jest.mocked(useMyListings).mockReturnValue({
      data: [
        {
          id: "l1",
          price: 140,
          isFeatured: false,
          expiresAt: ENDS,
          sellerId: "me",
          ownershipId: "o1",
          finish: "FOIL",
          serialNumber: 7,
          status: "ACTIVE",
          cardId: "c1",
          cardTitle: "Caphiria",
          soldAt: null,
        },
      ],
      isLoading: false,
    } as never);
    renderPane("selling");
    expect(
      screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"))
    ).toEqual(["selling-fixed", "selling-auctions", "selling-bids"]);
    const fixed = within(screen.getByRole("region", { name: "Your listings" }));
    expect(fixed.getByText("Foil #7 · 3h 0m left")).toBeInTheDocument();
    fireEvent.click(fixed.getByRole("button", { name: "Cancel listing" }));
    expect(cancel).toHaveBeenCalledWith({ listingId: "l1" });
    jest.mocked(useMyListings).mockReturnValue({ data: [], isLoading: false } as never);
  });

  it("lists the player's auctions; one with bids cannot be cancelled, and a cancel frees the card", () => {
    const cancel = jest.fn();
    let cancelled: { onSuccess: (result: { message: string }) => void } | undefined;
    jest.mocked(api.cardMarket.cancelAuction.useMutation).mockImplementation(((
      options: typeof cancelled
    ) => {
      cancelled = options;
      return { mutate: cancel, isPending: false };
    }) as never);
    jest.mocked(api.cardMarket.getMyActiveAuctions.useQuery).mockReturnValue({
      data: {
        auctions: [
          { ...auction, id: "mine-open", bidCount: 0, currentBid: 0 },
          { ...auction, id: "mine-ended", endTime: new Date(Date.now() - HOUR) },
        ],
      },
      isLoading: false,
    } as never);
    renderPane("selling");
    const listings = within(screen.getByRole("region", { name: "Your auctions" }));
    expect(listings.getByText("50 IxC · 0 bids · 3h 0m left")).toBeInTheDocument();
    expect(listings.getByText("100 IxC · 2 bids · Ended")).toBeInTheDocument();
    const [open, ended] = listings.getAllByRole("button", { name: "Cancel" });
    expect(ended).toBeDisabled();
    expect(ended).toHaveAccessibleDescription("Has bids, so it cannot be cancelled");
    expect(listings.getAllByText("Has bids, so it cannot be cancelled")).toHaveLength(1);
    fireEvent.click(open!);
    expect(cancel).toHaveBeenCalledWith({ auctionId: "mine-open" });
    // A face in a list row is never narrower than Browse's
    for (const card of listings.getAllByRole("button", {
      name: "Caphiria, Epic, Standard, Ixnay",
    })) {
      expect(card).toHaveClass("w-20");
    }
    // The cancelled listing's copy is free again: Mine, the sheet and the Sell picker read it again.
    refreshCards.mockClear();
    cancelled?.onSuccess({ message: "Auction cancelled" });
    expect(refreshCards).toHaveBeenCalledTimes(1);
  });

  it("lists every running auction the player bid on, winning or outbid, and raises an outbid bid", () => {
    const placeBid = jest.fn();
    jest.mocked(useAuctionBid).mockReturnValue({
      placeBid,
      executeBuyout: jest.fn(),
      isBidding: false,
      isBuyingOut: false,
      error: null,
    });
    jest.mocked(api.cardMarket.getMyActiveBids.useQuery).mockReturnValue({
      data: {
        auctions: [
          { ...auction, id: "bid-1", winning: true },
          { ...auction, id: "bid-2", currentBid: 130, winning: false },
        ],
      },
      isLoading: false,
    } as never);
    renderPane("selling");
    const bids = within(screen.getByRole("region", { name: "Your bids" }));
    const [winning, outbid] = bids.getAllByRole("listitem");
    expect(within(winning!).getByText("Winning")).toBeInTheDocument();
    expect(within(winning!).getByText("100 IxC · 3h 0m left")).toBeInTheDocument();
    expect(within(winning!).queryByRole("button", { name: /Raise bid/ })).toBeNull();
    expect(within(outbid!).getByText("Outbid")).toBeInTheDocument();
    expect(within(outbid!).getByText("130 IxC · 3h 0m left")).toBeInTheDocument();
    fireEvent.click(within(outbid!).getByRole("button", { name: "Raise bid to 137 IxC" }));
    expect(placeBid).toHaveBeenCalledWith("bid-2", 137);
  });

  it("says when the player has no bids running", () => {
    jest.mocked(api.cardMarket.getMyActiveBids.useQuery).mockReturnValue({
      data: { auctions: [] },
      isLoading: false,
    } as never);
    renderPane("selling");
    expect(screen.getByText("No bids running")).toBeInTheDocument();
    expect(screen.getByText("Auctions you bid on appear here until they end.")).toBeInTheDocument();
  });

  it("splits open offers into the ones waiting on the player and the ones waiting on the other side", () => {
    jest.mocked(api.trading.getActiveTrades.useQuery).mockReturnValue({
      data: [
        {
          id: "t1",
          myTurn: true,
          initiator: { clerkUserId: "clerk_ann", displayName: "@ann" },
          recipient: { clerkUserId: "clerk_me", displayName: "@max" },
        },
        {
          id: "t2",
          myTurn: false,
          initiator: { clerkUserId: "clerk_me", displayName: "@max" },
          recipient: { clerkUserId: "clerk_ann", displayName: "@ann" },
        },
      ],
      refetch: jest.fn(),
    } as never);
    renderPane("trades");
    const incoming = screen.getByRole("tab", { name: /^Incoming\s*, 1 offer$/ });
    const panel = screen.getByRole("tabpanel", { name: "Incoming" });
    expect(incoming).toHaveAttribute("aria-controls", panel.id);
    expect(within(panel).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=trades&trade=t1"
    );
    expect(within(panel).getByText("Your turn")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Sent\s*, 1 offer$/ }));
    const sent = within(screen.getByRole("tabpanel", { name: "Sent" }));
    expect(sent.getByText("Trade with @ann")).toBeInTheDocument();
    expect(sent.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=trades&trade=t2"
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("No trades or auctions yet")).toBeInTheDocument();
  });

  it("opens the trade builder the address names on the Trades tab, and closes it through the hub", () => {
    const props = renderPane("trades", {
      trade: { trade: "t7", partner: null, give: null, get: null },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close trade t7" }));
    expect(props.onCloseTrade).toHaveBeenCalledTimes(1);
  });

  it("names a past trade's partner as the server names them in History, else a player", () => {
    const history = jest.mocked(api.trading.getTradeHistory.useQuery);
    history.mockReturnValue({
      data: {
        trades: [
          {
            id: "t9",
            status: "ACCEPTED",
            updatedAt: new Date("2026-10-03T00:00:00Z"),
            initiatorCardIds: ["o1"],
            recipientCardIds: [],
            initiator: { clerkUserId: "clerk_ann", displayName: "Caphiria" },
            recipient: { clerkUserId: "clerk_me", displayName: "@max" },
          },
          {
            id: "t8",
            status: "ACCEPTED",
            updatedAt: new Date("2026-10-02T00:00:00Z"),
            initiatorCardIds: [],
            recipientCardIds: ["o2"],
            initiator: { clerkUserId: "clerk_me", displayName: "@max" },
            recipient: { clerkUserId: "clerk_kir", displayName: null },
          },
        ],
      },
    } as never);
    renderPane("trades");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("Trade with Caphiria · gave 0, got 1")).toBeInTheDocument();
    expect(screen.getByText("Trade with a player · gave 0, got 1")).toBeInTheDocument();
    history.mockReturnValue({ data: { trades: [] } } as never);
  });

  it("shows the wishlist, and sends an empty one to Browse", () => {
    const props = renderPane("wishlist");
    expect(screen.getByText("No cards on your wishlist yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
    expect(props.onTabChange).toHaveBeenCalledWith("browse");
  });

  it("opens a wished card's sheet from the wishlist", () => {
    jest.mocked(useWishlist).mockReturnValue({
      data: [
        {
          face: { ...face, copy: null },
          addedAt: new Date(),
          owned: 0,
          listings: 1,
          lowestPrice: 140,
          auctions: 0,
        },
      ],
      isLoading: false,
    } as never);
    const props = renderPane("wishlist");
    fireEvent.click(screen.getByRole("button", { name: /^Caphiria/ }));
    expect(props.onOpenCard).toHaveBeenCalledWith("c1");
    jest.mocked(useWishlist).mockReturnValue({ data: [], isLoading: false } as never);
  });
});
