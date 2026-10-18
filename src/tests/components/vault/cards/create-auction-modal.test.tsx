import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: { listMine: { useInfiniteQuery: jest.fn() } },
    cardMarket: { createAuction: { useMutation: jest.fn() } },
  },
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CreateAuctionModal } from "~/components/vault/cards/market/CreateAuctionModal";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const row = (
  ownershipId: string,
  serialNumber: number,
  isLocked = false,
  isBound = false,
  title = "Caphiria"
) => ({
  face: {
    cardId: "c1",
    title,
    rarity: "EPIC" as const,
    cardType: "LORE" as const,
    realm,
    artwork: null,
    silhouette: false,
    number: 1,
    season: null,
    isRetired: false,
    copy: { ownershipId, finish: "FOIL" as const, serialNumber, level: 1 },
  },
  value: 100,
  copies: 3,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked,
  isBound,
});

const refreshCards = jest.mocked(useCardsRefresh());
type Listed = (result: { message: string }) => void;
let mutate: jest.Mock;
let onSuccess: Listed = () => undefined;

type Row = ReturnType<typeof row>;
const fetchNextPage = jest.fn();
/** Mine as the picker pages it: `pages` of copies, and whether a further page waits. */
const mine = (pages: Row[][], hasNextPage = false) =>
  jest.mocked(api.cards.listMine.useInfiniteQuery).mockReturnValue({
    data: { pages: pages.map((rows) => ({ rows })) },
    isLoading: false,
    hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage,
  } as never);
const lastQuery = () => jest.mocked(api.cards.listMine.useInfiniteQuery).mock.calls.at(-1);

beforeEach(() => {
  refreshCards.mockClear();
  fetchNextPage.mockClear();
  mutate = jest.fn();
  mine([[row("o1", 4), row("o2", 9), row("o3", 12, true), row("o4", 20, false, true)]]);
  jest.mocked(api.cardMarket.createAuction.useMutation).mockImplementation(((options: {
    onSuccess: typeof onSuccess;
  }) => {
    onSuccess = options.onSuccess;
    return { mutate, isPending: false };
  }) as never);
});

const field = (name: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
const list = () => screen.getByRole("button", { name: "List it" });
/** What the last listing sent, and the callback that closes the form once it lands. */
const listing = () => mutate.mock.calls.at(-1)?.[0];
const landed = (message: string) =>
  act(() => {
    onSuccess({ message });
    (mutate.mock.calls.at(-1)?.[1] as { onSuccess: Listed }).onSuccess({ message });
  });

describe("CreateAuctionModal", () => {
  it("lists copies, not cards, and leaves out a copy already listed or traded, or bound", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} />);
    const copies = within(screen.getByRole("list", { name: "Your cards" })).getAllByRole("button");
    expect(copies).toHaveLength(2);
    expect(copies[0]).toHaveTextContent("Caphiria#4 · Foil");
    expect(copies[1]).toHaveTextContent("Caphiria#9 · Foil");
    // The face is hidden from the button's name, which says the title once.
    expect(copies[0]).toHaveAccessibleName(/^Caphiria\s*#4 · Foil$/);
    expect(screen.queryByText(/#12/)).toBeNull();
    expect(screen.queryByText(/#20/)).toBeNull();
  });

  it("searches every copy, most valuable first, a page at a time", () => {
    mine([[row("o1", 4)], [row("o9", 31, false, false, "Urcea")]], true);
    render(<CreateAuctionModal open onClose={jest.fn()} />);
    expect(lastQuery()?.[0]).toEqual({ search: undefined, sort: "value", limit: 120 });
    expect(lastQuery()?.[1]).toMatchObject({ enabled: true });
    const copies = within(screen.getByRole("list", { name: "Your cards" })).getAllByRole("button");
    expect(copies).toHaveLength(2);
    expect(copies[0]).toHaveAccessibleName(/^Caphiria\s*#4 · Foil$/);
    expect(copies[1]).toHaveAccessibleName(/^Urcea\s*#31 · Foil$/);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your cards" }), {
      target: { value: " Urc " },
    });
    expect(lastQuery()?.[0]).toMatchObject({ search: "Urc" });
  });

  it("pages past a page of copies that cannot be listed, and says when a search finds none", () => {
    mine([[row("o3", 12, true)]], true);
    const { rerender } = render(<CreateAuctionModal open onClose={jest.fn()} />);
    expect(screen.queryByText("No cards to sell")).toBeNull();
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    mine([[]]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your cards" }), {
      target: { value: "Nowhere" },
    });
    rerender(<CreateAuctionModal open onClose={jest.fn()} />);
    expect(screen.getByText("No cards match this search")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("lists the copy picked, at the prices typed", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} />);
    expect(list()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /#9/ }));
    expect(screen.getByRole("button", { name: /#9/ })).toHaveAttribute("aria-pressed", "true");
    field(/Starting price/, "40");
    field(/Buy-now price/, "90");
    fireEvent.click(list());
    expect(listing()).toEqual({
      cardId: "o2",
      startingPrice: 40,
      buyoutPrice: 90,
      duration: "60",
    });
  });

  it("starts on the copy the sheet sent, and leaves the buy-now price out when it is empty", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} initialOwnershipId="o1" />);
    expect(screen.getByRole("button", { name: /#4/ })).toHaveAttribute("aria-pressed", "true");
    field(/Starting price/, "25");
    fireEvent.click(screen.getByRole("radio", { name: "30 minutes" }));
    fireEvent.click(list());
    expect(listing()).toEqual({
      cardId: "o1",
      startingPrice: 25,
      buyoutPrice: undefined,
      duration: "30",
    });
  });

  it("says a bound copy from the sheet cannot be sold, instead of offering the form", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} initialOwnershipId="o4" />);
    expect(screen.getByText("Bound cards can't be sold")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Your cards" })).toBeNull();
    expect(screen.queryByLabelText(/Starting price/)).toBeNull();
    expect(screen.queryByRole("button", { name: "List it" })).toBeNull();
  });

  it("refuses a buy-now price at or under the start, and prices that are not whole IxC", () => {
    render(<CreateAuctionModal open onClose={jest.fn()} initialOwnershipId="o1" />);
    field(/Starting price/, "50");
    field(/Buy-now price/, "50");
    fireEvent.click(list());
    expect(vaultNotify.error).toHaveBeenCalledWith(
      "The buy-now price must be above the starting price"
    );
    field(/Buy-now price/, "60.5");
    expect(list()).toBeDisabled();
    field(/Buy-now price/, "");
    field(/Starting price/, "0");
    expect(list()).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("closes once the copy is listed, and reads the listed copy's places again", () => {
    const onClose = jest.fn();
    render(<CreateAuctionModal open onClose={onClose} initialOwnershipId="o1" />);
    field(/Starting price/, "25");
    fireEvent.click(list());
    expect(refreshCards).not.toHaveBeenCalled();
    landed("Auction created");
    expect(vaultNotify.success).toHaveBeenCalledWith("Auction created");
    expect(refreshCards).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only once when the player closes it while the listing is on its way", () => {
    const onClose = jest.fn();
    render(<CreateAuctionModal open onClose={onClose} initialOwnershipId="o1" />);
    field(/Starting price/, "25");
    fireEvent.click(list());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    landed("Auction created");
    expect(vaultNotify.success).toHaveBeenCalledWith("Auction created");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
