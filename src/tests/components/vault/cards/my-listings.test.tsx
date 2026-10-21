/** Selling's fixed-price listings: cancel a running one, and see how the others ended. */
import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/cards/useMarketTabs", () => ({
  useMyListings: jest.fn(),
  useListingActions: jest.fn(),
}));

import { useListingActions, useMyListings } from "~/hooks/cards/useMarketTabs";
import { MyListings } from "~/components/vault/cards/market/MyListings";

const AT = new Date(Date.now() + 86_400_000 + 60_000);
const listing = (over: object) => ({
  id: "l1",
  price: 1400,
  isFeatured: false,
  expiresAt: AT,
  sellerId: "me",
  ownershipId: "o1",
  finish: "STANDARD",
  serialNumber: 3,
  status: "ACTIVE",
  cardId: "c1",
  cardTitle: "Aurelia",
  soldAt: null,
  ...over,
});
const mine = (result: object) =>
  jest
    .mocked(useMyListings)
    .mockReturnValue({ isLoading: false, isError: false, ...result } as never);

let cancel: jest.Mock;
const actions = (isPending = false) =>
  jest
    .mocked(useListingActions)
    .mockReturnValue({ cancel: { mutate: cancel, isPending } } as never);
beforeEach(() => {
  cancel = jest.fn();
  actions();
});

describe("MyListings", () => {
  it("cancels an active listing and shows how the others ended", () => {
    mine({
      data: [
        listing({}),
        listing({ id: "l2", status: "SOLD", soldAt: new Date() }),
        listing({ id: "l3", status: "EXPIRED", finish: "FOIL" }),
        listing({ id: "l4", status: "CANCELLED" }),
      ],
    });
    render(<MyListings />);
    const section = within(screen.getByRole("region", { name: "Your listings" }));
    const [active, sold, expired, cancelled] = section.getAllByRole("listitem");
    expect(within(active!).getByText("Aurelia · 1,400 IxC")).toBeTruthy();
    expect(within(active!).getByText("Standard #3 · 1d 0h left")).toBeTruthy();
    const button = within(active!).getByRole("button", { name: "Cancel listing" });
    expect(button).toHaveAccessibleDescription("Aurelia · 1,400 IxC");
    fireEvent.click(button);
    expect(cancel).toHaveBeenCalledWith({ listingId: "l1" });
    expect(within(sold!).getByText("Sold")).toBeTruthy();
    expect(within(expired!).getByText("Expired")).toBeTruthy();
    expect(within(expired!).getByText("Foil #3")).toBeTruthy();
    expect(within(cancelled!).getByText("Cancelled")).toBeTruthy();
    expect(section.getAllByRole("button", { name: "Cancel listing" })).toHaveLength(1);
  });

  it("holds Cancel while a cancel is on its way", () => {
    actions(true);
    mine({ data: [listing({})] });
    render(<MyListings />);
    expect(screen.getByRole("button", { name: "Cancel listing" })).toBeDisabled();
  });
});
