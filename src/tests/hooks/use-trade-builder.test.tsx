/**
 * The trade builder's reads and mutations: which reads wait for a partner or a handle, a seeded copy that is not a
 * tradeable copy of yours, and the one refresh after a trade moves (or a conflict says it moved under you).
 */
import { act, renderHook } from "@testing-library/react";

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

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import {
  useFindPartner,
  usePartnerSearch,
  usePartnerWishlist,
  useSeedCopy,
  useTradeables,
  useTradeDetails,
  useTradeMutations,
} from "~/hooks/cards/useTradeBuilder";

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
const lastCall = (procedure: { useQuery: object }) =>
  (procedure.useQuery as jest.Mock).mock.calls.at(-1);

function optionsOf(kind: Kind): Options {
  const { result } = renderHook(() => useTradeMutations());
  return (result.current[kind] as never as { options: Options }).options;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("trade builder reads", () => {
  it("searches once two characters are typed past the @, after a pause", () => {
    jest.useFakeTimers();
    const search = jest.mocked(api.trading.searchPartners);
    const { rerender } = renderHook(({ q }) => usePartnerSearch(q), { initialProps: { q: "@b" } });
    expect(lastCall(search)?.[1]).toMatchObject({ enabled: false });
    rerender({ q: " @bo " });
    expect(lastCall(search)?.[0]).toEqual({ query: "@b" });
    act(() => jest.advanceTimersByTime(300));
    expect(lastCall(search)).toEqual([
      { query: "@bo" },
      expect.objectContaining({ enabled: true }),
    ]);
  });

  it("finds a partner only for a handle, and reads a trade only for an id", () => {
    renderHook(() => useFindPartner(null));
    expect(lastCall(api.trading.findPartner)?.[1]).toMatchObject({ enabled: false });
    renderHook(() => useFindPartner("bob"));
    expect(lastCall(api.trading.findPartner)).toEqual([
      { handle: "bob" },
      expect.objectContaining({ enabled: true }),
    ]);
    renderHook(() => useTradeDetails(null));
    expect(lastCall(api.trading.getTradeById)?.[1]).toMatchObject({ enabled: false });
    renderHook(() => useTradeDetails("t9"));
    expect(lastCall(api.trading.getTradeById)).toEqual([
      { tradeId: "t9" },
      expect.objectContaining({ enabled: true }),
    ]);
  });

  it("reads tradeables and the wishlist only with a partner, searching by title", () => {
    jest.useFakeTimers();
    renderHook(() => useTradeables(null, "theirs", ""));
    expect(lastCall(api.trading.getTradeables)?.[1]).toMatchObject({ enabled: false });
    const { rerender } = renderHook(({ s }) => useTradeables("bob", "theirs", s), {
      initialProps: { s: "" },
    });
    expect(lastCall(api.trading.getTradeables)).toEqual([
      { partnerId: "bob", side: "theirs", filters: {}, limit: 60 },
      expect.objectContaining({ enabled: true }),
    ]);
    rerender({ s: " Aure " });
    act(() => jest.advanceTimersByTime(300));
    expect(lastCall(api.trading.getTradeables)?.[0]).toEqual({
      partnerId: "bob",
      side: "theirs",
      filters: { search: "Aure" },
      limit: 60,
    });
    // A new search keeps the last page on screen while it loads.
    const options: { placeholderData: <T>(previous: T) => T } | undefined = lastCall(
      api.trading.getTradeables
    )?.[1];
    expect(options?.placeholderData({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });

    renderHook(() => usePartnerWishlist(null));
    expect(lastCall(api.trading.getPartnerWishlist)?.[1]).toMatchObject({ enabled: false });
    renderHook(() => usePartnerWishlist("bob"));
    expect(lastCall(api.trading.getPartnerWishlist)).toEqual([
      { partnerId: "bob" },
      expect.objectContaining({ enabled: true }),
    ]);
  });

  it("resolves a seeded copy of yours wherever it falls in Mine, and refuses one that can't be traded", () => {
    const listMine = jest.mocked(api.cards.listMine.useQuery);
    const row = (over: object = {}) => ({
      face: { cardId: "c1", title: "Aurelia", copy: { ownershipId: "o1" } },
      value: 40,
      isLocked: false,
      isBound: false,
      ...over,
    });
    const seed = (rows: object[] | undefined) => {
      listMine.mockReturnValue({ data: rows && { rows } } as never);
      return renderHook(() => useSeedCopy("o1")).result.current;
    };
    expect(renderHook(() => useSeedCopy(null)).result.current).toBeUndefined();
    expect(lastCall(api.cards.listMine)?.[1]).toMatchObject({ enabled: false });
    expect(seed(undefined)).toBeUndefined();
    expect(lastCall(api.cards.listMine)).toEqual([
      { copyId: "o1", limit: 1 },
      expect.objectContaining({ enabled: true }),
    ]);
    expect(seed([row()])).toEqual({
      ownershipId: "o1",
      face: row().face,
      inscription: null,
      value: 40,
    });
    expect(seed([])).toBeNull();
    expect(seed([row({ isLocked: true })])).toBeNull();
    expect(seed([row({ isBound: true })])).toBeNull();
  });
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
