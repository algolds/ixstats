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

import { api } from "~/trpc/react";
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
const utils = () => api.useUtils();
const failure = (code: string, message = "Nope.") => ({ message, data: { code } });

beforeEach(() => jest.clearAllMocks());

describe("useMarketActions", () => {
  it.each<Action>(["buy", "craft"])("%s reads the card screens again", (action) => {
    optionsOf(action).onSuccess!({ price: 140 });
    expect(refreshCards()).toHaveBeenCalledTimes(1);
  });

  it("says what a purchase and a craft did", () => {
    optionsOf("buy").onSuccess!({ price: 1400 });
    optionsOf("craft").onSuccess!({ ownershipId: "o9", dust: 40, credits: 10 });
    expect(jest.mocked(vaultNotify.success).mock.calls).toEqual([
      ["The copy is yours for 1,400 IxC.", "Bought"],
      ["A Standard copy is in your collection.", "Crafted"],
    ]);
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

  it.each<Action>(["craft", "wish", "unwish", "setMute"])(
    "%s toasts a failure and reads nothing again",
    (action) => {
      optionsOf(action).onError!({ message: "This card can't be crafted right now." });
      expect(vaultNotify.error).toHaveBeenCalledWith("This card can't be crafted right now.");
      expect(refreshCards()).not.toHaveBeenCalled();
    }
  );

  it.each<Action>(["wish", "unwish"])(
    "%s reads the card's economy, the sheet's wanted count and the wishlist again, not every card screen",
    (action) => {
      optionsOf(action).onSuccess!({ cardId: "c1" });
      expect(utils().cards.getSheetEconomy.invalidate).toHaveBeenCalledWith({ cardId: "c1" });
      expect(utils().cards.getSheet.invalidate).toHaveBeenCalledTimes(1);
      expect(utils().cardMarket.getWishlist.invalidate).toHaveBeenCalledTimes(1);
      expect(refreshCards()).not.toHaveBeenCalled();
    }
  );

  it("keeps the mute the server answered", () => {
    optionsOf("setMute").onSuccess!({ muted: true });
    expect(utils().cards.getCardMute.setData).toHaveBeenCalledWith({ cardId: "c1" }, true);
  });

  it("acknowledges a report and leaves its failure to the report dialog", () => {
    const report = optionsOf("report");
    report.onSuccess!({ reportId: "r1" });
    expect(vaultNotify.success).toHaveBeenCalledWith(
      "Staff will look at this inscription.",
      "Reported"
    );
    expect(report.onError).toBeUndefined();
  });
});
