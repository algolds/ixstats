import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const query = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { getSheet: query(), getSheetEconomy: query(), exploreShelves: query() },
    cardMarket: { getMyListings: query(), getWishlist: query(), browse: query() },
  };
  return {
    api: {
      useUtils: () => utils,
      cardMarket: {
        browse: { useQuery: jest.fn() },
        cancelListing: { useMutation: jest.fn() },
        removeFromWishlist: { useMutation: jest.fn() },
      },
    },
  };
});
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { api } from "~/trpc/react";
import { useBrowse, useListingActions } from "~/hooks/cards/useMarketTabs";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface Handlers<T> {
  onSuccess: (data: T) => Promise<void> | void;
  onError: (error: { message: string }) => void;
}
type Utils = Record<string, Record<string, { invalidate: jest.Mock }>>;
const utils = api.useUtils() as never as Utils;
const refreshCards = jest.mocked(useCardsRefresh());
let cancel: Handlers<{ refund: number }>;
let unwish: Handlers<{ cardId: string; wished: boolean }>;

/** Every query read again, as `router.procedure`. */
const refetched = () =>
  Object.entries(utils).flatMap(([router, procedures]) =>
    Object.entries(procedures)
      .filter(([, query]) => query.invalidate.mock.calls.length > 0)
      .map(([name]) => `${router}.${name}`)
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.cardMarket.cancelListing.useMutation).mockImplementation(((
    options: typeof cancel
  ) => {
    cancel = options;
    return { mutate: jest.fn(), isPending: false };
  }) as never);
  jest.mocked(api.cardMarket.removeFromWishlist.useMutation).mockImplementation(((
    options: typeof unwish
  ) => {
    unwish = options;
    return { mutate: jest.fn(), isPending: false };
  }) as never);
});

describe("useBrowse", () => {
  it("keeps the current page on screen while a longer one or a new filter loads", () => {
    renderHook(() =>
      useBrowse({ kind: "all", sort: "ending_soon", filters: {}, limit: 20, offset: 0 })
    );
    const [input, options] = jest.mocked(api.cardMarket.browse.useQuery).mock.lastCall!;
    expect(input).toMatchObject({ kind: "all", limit: 20 });
    const previous = { items: [], hasMore: true };
    const keep = options?.placeholderData;
    expect(typeof keep === "function" && keep(previous as never, undefined)).toBe(previous);
  });
});

describe("useListingActions", () => {
  it("frees the copy of a cancelled listing through the one refresh and says what came back", () => {
    renderHook(() => useListingActions());
    void cancel.onSuccess({ refund: 2500 });
    expect(vaultNotify.success).toHaveBeenCalledWith(
      "2,500 IxC of the listing fee came back.",
      "Listing cancelled"
    );
    expect(refreshCards).toHaveBeenCalledTimes(1);
  });

  it("says so when no fee comes back", () => {
    renderHook(() => useListingActions());
    void cancel.onSuccess({ refund: 0 });
    expect(vaultNotify.success).toHaveBeenCalledWith(
      "The copy is back in your collection.",
      "Listing cancelled"
    );
  });

  it("says why a cancel failed and reads the listings again, since one may have sold", () => {
    renderHook(() => useListingActions());
    cancel.onError({ message: "This listing has already sold or ended." });
    expect(vaultNotify.error).toHaveBeenCalledWith("This listing has already sold or ended.");
    expect(refetched()).toEqual(["cardMarket.getMyListings"]);
    expect(refreshCards).not.toHaveBeenCalled();
  });

  it("takes a card off the wishlist and reads only the wishlist and the sheet again", async () => {
    renderHook(() => useListingActions());
    await unwish.onSuccess({ cardId: "c1", wished: false });
    expect(refetched()).toEqual([
      "cards.getSheet",
      "cards.getSheetEconomy",
      "cardMarket.getWishlist",
    ]);
    expect(refreshCards).not.toHaveBeenCalled();
    unwish.onError({ message: "Too many requests" });
    expect(vaultNotify.error).toHaveBeenCalledWith("Too many requests");
  });
});
