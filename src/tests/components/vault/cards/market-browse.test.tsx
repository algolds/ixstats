/** Browse: live listings and auctions in one list, with Buy or Bid on another player's, and the filters it asks for. */
import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/cards/useMarketTabs", () => ({ useBrowse: jest.fn() }));
jest.mock("~/hooks/marketplace/useAuctionBid", () => ({
  useAuctionBid: jest.fn(() => ({
    placeBid: jest.fn(),
    executeBuyout: jest.fn(),
    isBidding: false,
    isBuyingOut: false,
  })),
}));
jest.mock("~/trpc/react", () => ({
  api: { cards: { exploreShelves: { useQuery: jest.fn(() => ({ data: { realms: [] } })) } } },
}));
jest.mock("~/components/vault/cards/market/CreateAuctionModal", () => ({
  CreateAuctionModal: () => null,
}));
jest.mock("~/components/cards/sheet/economy/BuyListingDialog", () => ({
  BuyListingDialog: jest.fn(() => <div role="dialog">buy dialog</div>),
}));
jest.mock("~/components/cards/face/CardFace", () => ({
  CardFace: ({ face }: { face: { title: string } }) => <span>{face.title}</span>,
}));

import { useBrowse } from "~/hooks/cards/useMarketTabs";
import { BuyListingDialog } from "~/components/cards/sheet/economy/BuyListingDialog";
import { MarketBrowse } from "~/components/vault/cards/market/MarketBrowse";

const AT = new Date(Date.now() + 86_400_000 + 60_000);
const face = {
  cardId: "c1",
  title: "Aurelia",
  rarity: "RARE" as const,
  cardType: "LORE" as const,
  artwork: null,
  silhouette: false,
  number: 1,
  season: null,
  isRetired: false,
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  copy: { ownershipId: "o1", finish: "FOIL" as const, serialNumber: 7, level: 1 },
};
const item = (over: object) => ({
  kind: "listing",
  id: "l1",
  price: 140,
  isFeatured: false,
  endsAt: AT,
  createdAt: AT,
  isMine: false,
  ownershipId: "o1",
  bidCount: 0,
  buyoutPrice: null,
  face,
  ...over,
});
const browsing = (items: object[], extra: object = {}) =>
  jest.mocked(useBrowse).mockReturnValue({
    data: { items, hasMore: false },
    isLoading: false,
    isError: false,
    ...extra,
  } as never);

function renderBrowse(forCardId: string | null = null) {
  const props = {
    forCardId,
    onClearFor: jest.fn(),
    onOpenCard: jest.fn(),
    onShowSelling: jest.fn(),
  };
  render(<MarketBrowse {...props} />);
  return props;
}

beforeEach(() => {
  jest.mocked(BuyListingDialog).mockClear();
  browsing([
    item({ isFeatured: true }),
    item({ kind: "auction", id: "a1", price: 90, bidCount: 2 }),
    item({ id: "l2", isMine: true }),
  ]);
});

describe("MarketBrowse", () => {
  it("shows listings with Buy (not on your own) and auctions with bidding, featured marked", () => {
    const props = renderBrowse();
    const [featured, auction, own] = within(
      screen.getByRole("list", { name: "Listings" })
    ).getAllByRole("listitem");
    expect(within(featured!).getByText("Featured")).toBeTruthy();
    expect(within(featured!).getByText("Foil #7 · 1d 0h left")).toBeTruthy();
    expect(within(auction!).queryByText("Featured")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Buy for 140 IxC" })).toHaveLength(1);
    expect(within(auction!).getByRole("button", { name: "Bid 95 IxC" })).toBeTruthy();
    expect(within(own!).getByText("Your listing")).toBeTruthy();
    expect(within(own!).queryByRole("button", { name: /^Buy/ })).toBeNull();
    fireEvent.click(within(own!).getByRole("button", { name: "See it in Selling" }));
    expect(props.onShowSelling).toHaveBeenCalled();
  });

  it("marks a featured auction too, and shows the player's own auction without bid controls", () => {
    browsing([
      item({ kind: "auction", id: "a1", isFeatured: true }),
      item({ kind: "auction", id: "a2", isMine: true }),
    ]);
    const props = renderBrowse();
    const [featured, own] = within(screen.getByRole("list", { name: "Listings" })).getAllByRole(
      "listitem"
    );
    expect(within(featured!).getByText("Featured")).toBeTruthy();
    expect(within(featured!).getByRole("button", { name: "Bid 147 IxC" })).toBeTruthy();
    expect(within(own!).getByText("Your listing")).toBeTruthy();
    expect(within(own!).queryByRole("button", { name: /^Bid / })).toBeNull();
    fireEvent.click(within(own!).getByRole("button", { name: "See it in Selling" }));
    expect(props.onShowSelling).toHaveBeenCalled();
  });

  it("asks for the chosen kind, the sort and the card from the sheet", () => {
    renderBrowse("c1");
    expect(jest.mocked(useBrowse).mock.lastCall?.[0]).toMatchObject({ kind: "all", offset: 0 });
    fireEvent.click(screen.getByRole("radio", { name: "Listings" }));
    expect(jest.mocked(useBrowse).mock.lastCall?.[0]).toMatchObject({
      kind: "listings",
      sort: "ending_soon",
      limit: 20,
      filters: { cardId: "c1" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Auctions" }));
    expect(jest.mocked(useBrowse).mock.lastCall?.[0]).toMatchObject({ kind: "auctions" });
  });

  it("buys another player's listing in the purchase dialog, naming no seller", () => {
    renderBrowse();
    expect(BuyListingDialog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Buy for 140 IxC" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("buy dialog");
    expect(jest.mocked(BuyListingDialog).mock.lastCall?.[0]).toMatchObject({
      cardId: "c1",
      cardTitle: "Aurelia",
      listing: { id: "l1", price: 140, finish: "FOIL", serialNumber: 7, sellerName: null },
    });
  });

  it("shows more a page at a time while the server says more follow", () => {
    browsing([item({})], { data: { items: [item({})], hasMore: true } });
    renderBrowse();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(jest.mocked(useBrowse).mock.lastCall?.[0]).toMatchObject({ limit: 40 });
  });
});
