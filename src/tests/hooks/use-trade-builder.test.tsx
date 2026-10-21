/**
 * The trade builder's reads and mutations: which reads wait for a partner or a handle, a seeded copy that is not a
 * tradeable copy of yours, and the one refresh after a trade moves (or a conflict says it moved under you).
 */
import { renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const query = () => ({ useQuery: jest.fn(() => ({ data: undefined })) });
  const mutation = () => ({ useMutation: jest.fn((options: object) => ({ options })) });
  return {
    api: {
      trading: {
        searchPartners: query(),
        findPartner: query(),
        getTradeables: query(),
        getPartnerWishlist: query(),
        getTradeById: query(),
        createtradeOffer: mutation(),
        counterTrade: mutation(),
        respondToTrade: mutation(),
        cancelTrade: mutation(),
      },
      cards: { listMine: query() },
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
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { useTradeMutations } from "~/hooks/cards/useTradeBuilder";

interface Failure {
  message: string;
  data?: { code: string } | null;
}
interface Options {
  onSuccess?: (result: { status: string }) => void;
  onError?: (error: Failure) => void;
}
type Kind = "create" | "counter" | "respond" | "cancel";

const refreshCards = jest.mocked(useCardsRefresh());

function optionsOf(kind: Kind): Options {
  const { result } = renderHook(() => useTradeMutations());
  return (result.current[kind] as never as { options: Options }).options;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
describe("trade builder mutations", () => {
  it("reads the card screens again after each trade change, and says what happened", () => {
    optionsOf("create").onSuccess?.({ status: "PENDING" });
    expect(vaultNotify.success).toHaveBeenLastCalledWith(
      "They have 24 hours to answer.",
      "Offer sent"
    );
    optionsOf("counter").onSuccess?.({ status: "PENDING" });
    expect(vaultNotify.success).toHaveBeenLastCalledWith(
      "It is their turn to answer.",
      "Counter-offer sent"
    );
    optionsOf("respond").onSuccess?.({ status: "ACCEPTED" });
    expect(vaultNotify.success).toHaveBeenLastCalledWith(
      "The cards and credits have changed hands.",
      "Trade accepted"
    );
    optionsOf("respond").onSuccess?.({ status: "REJECTED" });
    expect(vaultNotify.success).toHaveBeenLastCalledWith("The offer is closed.", "Offer declined");
    optionsOf("cancel").onSuccess?.({ status: "CANCELLED" });
    expect(vaultNotify.success).toHaveBeenLastCalledWith(
      "Your cards are free again.",
      "Offer withdrawn"
    );
    expect(refreshCards).toHaveBeenCalledTimes(5);
  });

  it("reads the trade again when the server says it changed under you, and only then", () => {
    for (const kind of ["create", "counter", "respond", "cancel"] as const) {
      refreshCards.mockClear();
      optionsOf(kind).onError?.({ message: "Changed", data: { code: "CONFLICT" } });
      expect(refreshCards).toHaveBeenCalledTimes(1);
      optionsOf(kind).onError?.({ message: "Too few credits", data: { code: "BAD_REQUEST" } });
      optionsOf(kind).onError?.({ message: "Offline", data: null });
      expect(refreshCards).toHaveBeenCalledTimes(1);
    }
    // The sheet shows the message itself, so there is no toast as well.
    expect(vaultNotify.error).not.toHaveBeenCalled();
  });
});
