import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cardMarket: {
      placeBid: { useMutation: jest.fn() },
      executeBuyout: { useMutation: jest.fn() },
    },
  },
}));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { api } from "~/trpc/react";
import { useAuctionBid } from "~/hooks/marketplace/useAuctionBid";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface Handlers<T> {
  onSuccess: (data: T) => void;
  onError: (error: { message: string }) => void;
}
type BuyoutResult = { message: string; leveledUp?: boolean; newLevel?: number | null };

const refreshCards = jest.mocked(useCardsRefresh());
let bid: Handlers<{ message: string }>;
let buyout: Handlers<BuyoutResult>;
const mutateBid = jest.fn();
const mutateBuyout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.cardMarket.placeBid.useMutation).mockImplementation(((options: typeof bid) => {
    bid = options;
    return { mutate: mutateBid, isPending: false, error: null };
  }) as never);
  jest.mocked(api.cardMarket.executeBuyout.useMutation).mockImplementation(((
    options: typeof buyout
  ) => {
    buyout = options;
    return { mutate: mutateBuyout, isPending: false, error: null };
  }) as never);
});

describe("useAuctionBid", () => {
  it("bids and buys outright, then reads the cards, the Market and the balance again", () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useAuctionBid({ onSuccess }));
    result.current.placeBid("a1", 105);
    expect(mutateBid).toHaveBeenCalledWith({ auctionId: "a1", amount: 105 });
    // A bid holds its credits, so the balance moves.
    bid.onSuccess({ message: "Bid placed" });
    expect(vaultNotify.success).toHaveBeenCalledWith("Bid placed");
    expect(refreshCards).toHaveBeenCalledTimes(1);

    result.current.executeBuyout("a1");
    expect(mutateBuyout).toHaveBeenCalledWith({ auctionId: "a1" });
    buyout.onSuccess({ message: "Bought", leveledUp: true, newLevel: 3 });
    expect(vaultNotify.success).toHaveBeenCalledWith("Card leveled up to Level 3!", "Level Up!");
    expect(refreshCards).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);
  });

  it("says why a bid failed and reads nothing again", () => {
    renderHook(() => useAuctionBid());
    bid.onError({ message: "You are already the highest bidder" });
    buyout.onError({ message: "Auction has expired" });
    expect(vaultNotify.error).toHaveBeenCalledWith("You are already the highest bidder");
    expect(vaultNotify.error).toHaveBeenCalledWith("Auction has expired");
    expect(refreshCards).not.toHaveBeenCalled();
  });
});
