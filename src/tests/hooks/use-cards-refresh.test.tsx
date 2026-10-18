import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const query = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: {
      listMine: query(),
      getMyCards: query(),
      getMyDisplay: query(),
      listMyShowcases: query(),
      getSheet: query(),
      exploreShelves: query(),
      exploreGrid: query(),
      getWikiArticleExcerpt: query(),
    },
    cardMarket: {
      getActiveAuctions: query(),
      getMyActiveAuctions: query(),
      getMyActiveBids: query(),
      getMyAuctionParticipation: query(),
    },
    trading: {
      getActiveTrades: query(),
      getTradeById: query(),
      getTradeHistory: query(),
      searchTradingPartners: query(),
    },
    vault: { getBalance: query(), getTransactions: query() },
  };
  return { api: { useUtils: () => utils } };
});

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";

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
      "cards.getMyCards",
      "cards.getMyDisplay",
      "cards.listMyShowcases",
      "cards.getSheet",
      "cards.exploreShelves",
      "cards.exploreGrid",
      "cardMarket.getActiveAuctions",
      "cardMarket.getMyActiveAuctions",
      "cardMarket.getMyActiveBids",
      "cardMarket.getMyAuctionParticipation",
      "trading.getActiveTrades",
      "trading.getTradeById",
      "trading.getTradeHistory",
      "vault.getBalance",
    ]);
  });

  it("stays the same function across renders, so a socket subscription can hold it", () => {
    const { result, rerender } = renderHook(() => useCardsRefresh());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
