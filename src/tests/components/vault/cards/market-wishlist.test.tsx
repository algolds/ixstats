/** The Wishlist tab: each wished card with what is on sale for it, and taking one off. */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useMarketTabs", () => ({
  useWishlist: jest.fn(),
  useListingActions: jest.fn(),
}));
jest.mock("~/components/cards/face/CardFace", () => ({
  CardFace: ({ face, onOpen }: { face: { title: string }; onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      {face.title}
    </button>
  ),
}));

import { useListingActions, useWishlist } from "~/hooks/cards/useMarketTabs";
import { MarketWishlist } from "~/components/vault/cards/market/MarketWishlist";

const entry = (cardId: string, title: string, over: object) => ({
  face: { cardId, title },
  addedAt: new Date(),
  owned: 0,
  listings: 0,
  lowestPrice: null,
  auctions: 0,
  ...over,
});
const wishlist = (result: object) =>
  jest
    .mocked(useWishlist)
    .mockReturnValue({ isLoading: false, isError: false, ...result } as never);

let removeWish: jest.Mock;
beforeEach(() => {
  removeWish = jest.fn();
  jest
    .mocked(useListingActions)
    .mockReturnValue({ removeWish: { mutate: removeWish, isPending: false } } as never);
});

describe("MarketWishlist", () => {
  it("shows what is on sale for each wished card, opens its sheet and removes one", () => {
    wishlist({
      data: [
        entry("c1", "Aurelia", { listings: 2, lowestPrice: 1400, auctions: 1 }),
        entry("c2", "Burgundie", { owned: 1 }),
        entry("c3", "Caphiria", { listings: 1, lowestPrice: 9 }),
        entry("c4", "Dolch", { auctions: 3 }),
      ],
    });
    const onOpenCard = jest.fn();
    render(<MarketWishlist onBrowse={jest.fn()} onOpenCard={onOpenCard} />);
    expect(screen.getByText("2 listings from 1,400 IxC · 1 auction")).toBeTruthy();
    expect(screen.getByText("Not on sale right now · You own 1")).toBeTruthy();
    expect(screen.getByText("1 listing from 9 IxC")).toBeTruthy();
    expect(screen.getByText("3 auctions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Burgundie" }));
    expect(onOpenCard).toHaveBeenCalledWith("c2");
    fireEvent.click(screen.getByRole("button", { name: "Remove Aurelia from your wishlist" }));
    expect(removeWish).toHaveBeenCalledWith({ cardId: "c1" });
  });
});
