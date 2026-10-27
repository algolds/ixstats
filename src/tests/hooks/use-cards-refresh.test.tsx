import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const query = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: {
      listMine: query(),
      getMyDisplay: query(),
      listMyShowcases: query(),
      getSheet: query(),
      getSheetEconomy: query(),
      exploreShelves: query(),
      exploreGrid: query(),
      getWikiArticleExcerpt: query(),
    },
    cardMarket: {
      getMyActiveAuctions: query(),
      getMyActiveBids: query(),
      getMyAuctionParticipation: query(),
      browse: query(),
      getMyListings: query(),
      getWishlist: query(),
    },
    crafting: { getDust: query(), getNumbers: query() },
    trading: {
      getActiveTrades: query(),
      getTradeById: query(),
      getTradeHistory: query(),
      getTradeables: query(),
      getPartnerWishlist: query(),
    },
    vault: { getBalance: query(), getTransactions: query() },
  };
  return { api: { useUtils: () => utils } };
});

import { api } from "~/trpc/react";
import { useBidRefresh, useCardsRefresh } from "~/hooks/useCardsRefresh";

type Utils = Record<string, Record<string, { invalidate: jest.Mock }>>;
const utils = api.useUtils() as never as Utils;

/** Every query the refresh read again, as `router.procedure`. */
const refetched = () =>
  Object.entries(utils).flatMap(([router, procedures]) =>
    Object.entries(procedures)
      .filter(([, query]) => query.invalidate.mock.calls.length > 0)
      .map(([name]) => `${router}.${name}`)
  );

beforeEach(() => jest.clearAllMocks());

describe("useCardsRefresh", () => {
  it("reads again every place a copy that moved or locked shows, and nothing else", () => {
    const { result } = renderHook(() => useCardsRefresh());
    result.current();
    expect(refetched()).toEqual([
      "cards.listMine",
      "cards.getMyDisplay",
      "cards.listMyShowcases",
      "cards.getSheet",
      "cards.getSheetEconomy",
      "cards.exploreShelves",
      "cards.exploreGrid",
      "cardMarket.getMyActiveAuctions",
      "cardMarket.getMyActiveBids",
      "cardMarket.getMyAuctionParticipation",
      "cardMarket.browse",
      "cardMarket.getMyListings",
      "cardMarket.getWishlist",
      "crafting.getDust",
      "trading.getActiveTrades",
      "trading.getTradeById",
      "trading.getTradeHistory",
      "trading.getTradeables",
      "trading.getPartnerWishlist",
      "vault.getBalance",
    ]);
  });
});

describe("useBidRefresh", () => {
  it("reads again what a bid changes, and not Explore, since no copy moves", () => {
    const { result, rerender } = renderHook(() => useBidRefresh());
    const first = result.current;
    result.current();
    expect(refetched()).toEqual([
      "cards.getSheet",
      "cardMarket.getMyActiveBids",
      "cardMarket.browse",
      "vault.getBalance",
    ]);
    rerender();
    expect(result.current).toBe(first);
  });
});
