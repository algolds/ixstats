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
import { useListingActions } from "~/hooks/cards/useMarketTabs";
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
  it("says why a cancel failed and reads the listings again, since one may have sold", () => {
    renderHook(() => useListingActions());
    cancel.onError({ message: "This listing has already sold or ended." });
    expect(vaultNotify.error).toHaveBeenCalledWith("This listing has already sold or ended.");
    expect(refetched()).toEqual(["cardMarket.getMyListings"]);
    expect(refreshCards).not.toHaveBeenCalled();
  });
});
