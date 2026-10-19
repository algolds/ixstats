/** The Wishlist tab: each wished card with what is on sale for it, and taking one off. */
import React from "react";
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

  it("holds Remove while a removal is on its way", () => {
    jest
      .mocked(useListingActions)
      .mockReturnValue({ removeWish: { mutate: removeWish, isPending: true } } as never);
    wishlist({ data: [entry("c1", "Aurelia", {})] });
    render(<MarketWishlist onBrowse={jest.fn()} onOpenCard={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Remove Aurelia from your wishlist" })
    ).toBeDisabled();
  });

  it("says what to do when the wishlist is empty", () => {
    wishlist({ data: [] });
    const onBrowse = jest.fn();
    render(<MarketWishlist onBrowse={onBrowse} onOpenCard={jest.fn()} />);
    expect(screen.getByText("No cards on your wishlist yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
    expect(onBrowse).toHaveBeenCalled();
  });

  it("says when the wishlist did not load, and tries again", () => {
    const refetch = jest.fn();
    wishlist({ data: undefined, isError: true, refetch });
    render(<MarketWishlist onBrowse={jest.fn()} onOpenCard={jest.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your wishlist did not load");
    expect(screen.queryByText("No cards on your wishlist yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("marks itself busy while it loads", () => {
    wishlist({ data: undefined, isLoading: true, isFetching: true });
    render(<MarketWishlist onBrowse={jest.fn()} onOpenCard={jest.fn()} />);
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByText("No cards on your wishlist yet")).toBeNull();
  });
});
