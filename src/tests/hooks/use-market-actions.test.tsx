/**
 * The sheet's market mutations: a purchase or a craft reads the card screens again through the one refresh, a lost
 * purchase reads one clear way, the wishlist and the mute refresh only what they change, and a report is acknowledged.
 */
import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const mutation = () => ({ useMutation: jest.fn((options: object) => ({ options })) });
  const invalidate = () => ({ invalidate: jest.fn(), setData: jest.fn() });
  const utils = {
    cards: { getSheet: invalidate(), getSheetEconomy: invalidate(), getCardMute: invalidate() },
    cardMarket: { getWishlist: invalidate() },
  };
  return {
    api: {
      useUtils: () => utils,
      cardMarket: {
        buyListing: mutation(),
        addToWishlist: mutation(),
        removeFromWishlist: mutation(),
      },
      crafting: { craft: mutation() },
      cards: {
        setCardMute: mutation(),
        reportInscription: mutation(),
        getCardMute: { useQuery: jest.fn(() => ({ data: true })) },
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
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { useMarketActions } from "~/hooks/cards/useMarketActions";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-busy";

interface Failure {
  message: string;
  data?: { code: string } | null;
}
interface Options {
  onSuccess?: (result: object) => void;
  onError?: (error: Failure) => void;
}
type Action = "buy" | "craft" | "wish" | "unwish" | "setMute" | "report";

function optionsOf(action: Action): Options {
  const { result } = renderHook(() => useMarketActions("c1"));
  return (result.current[action] as never as { options: Options }).options;
}

const refreshCards = () => useCardsRefresh();
const failure = (code: string, message = "Nope.") => ({ message, data: { code } });

beforeEach(() => jest.clearAllMocks());

describe("useMarketActions", () => {
  it.each<Action>(["buy", "craft"])("%s reads the card screens again", (action) => {
    optionsOf(action).onSuccess!({ price: 140 });
    expect(refreshCards()).toHaveBeenCalledTimes(1);
  });
  it("reads the card screens again when the listing has gone, so it leaves the sheet, but not after a lost race", () => {
    // The dialog shows the failure itself, so the hook toasts nothing
    optionsOf("buy").onError!(failure("CONFLICT", VAULTS_BUSY_MESSAGE));
    optionsOf("buy").onError!(failure("BAD_REQUEST", "Insufficient credits."));
    expect(refreshCards()).not.toHaveBeenCalled();
    optionsOf("buy").onError!(failure("NOT_FOUND"));
    optionsOf("buy").onError!(failure("CONFLICT", "This listing was just sold or withdrawn."));
    expect(refreshCards()).toHaveBeenCalledTimes(2);
    expect(vaultNotify.error).not.toHaveBeenCalled();
  });
});
