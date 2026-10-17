import { renderHook } from "@testing-library/react";

type EventType = "bid" | "auction_complete" | "auction_created";

jest.mock("~/lib/websocket/market-websocket-client", () => {
  const listeners = new Map<string, () => void>();
  const client = {
    listeners,
    connect: jest.fn(),
    disconnect: jest.fn(),
    unsubscribe: jest.fn(),
    subscribeToAll: jest.fn((type: string, callback: () => void) => {
      listeners.set(type, callback);
      return () => client.unsubscribe(type);
    }),
  };
  return { getMarketWebSocketClient: () => client };
});
jest.mock("~/trpc/react", () => {
  const query = () => ({ invalidate: jest.fn() });
  const utils = {
    cardMarket: {
      getActiveAuctions: query(),
      getMyActiveAuctions: query(),
      getMyActiveBids: query(),
      getMyAuctionParticipation: query(),
    },
    vault: { getBalance: query() },
  };
  return { api: { useUtils: () => utils } };
});

import { api } from "~/trpc/react";
import { getMarketWebSocketClient } from "~/lib/websocket/market-websocket-client";
import { useAuctionWebSocket } from "~/hooks/marketplace/useAuctionWebSocket";

const client = getMarketWebSocketClient() as never as {
  listeners: Map<EventType, () => void>;
  connect: jest.Mock;
  disconnect: jest.Mock;
  unsubscribe: jest.Mock;
};
const utils = api.useUtils();
const QUERIES = {
  getActiveAuctions: utils.cardMarket.getActiveAuctions,
  getMyActiveAuctions: utils.cardMarket.getMyActiveAuctions,
  getMyActiveBids: utils.cardMarket.getMyActiveBids,
  getMyAuctionParticipation: utils.cardMarket.getMyAuctionParticipation,
  getBalance: utils.vault.getBalance,
};
/** The queries an event refetched, by name. */
const refetched = () =>
  Object.entries(QUERIES)
    .filter(([, query]) => jest.mocked(query.invalidate).mock.calls.length > 0)
    .map(([name]) => name);

beforeEach(() => {
  jest.clearAllMocks();
  client.listeners.clear();
});

describe("useAuctionWebSocket", () => {
  it("refetches what each market event changes", () => {
    renderHook(() => useAuctionWebSocket());
    expect(client.connect).toHaveBeenCalled();

    client.listeners.get("bid")?.();
    expect(refetched()).toEqual(["getActiveAuctions", "getMyActiveBids"]);

    jest.clearAllMocks();
    client.listeners.get("auction_complete")?.();
    expect(refetched()).toEqual([
      "getActiveAuctions",
      "getMyActiveAuctions",
      "getMyAuctionParticipation",
      "getBalance",
    ]);

    jest.clearAllMocks();
    client.listeners.get("auction_created")?.();
    expect(refetched()).toEqual(["getActiveAuctions", "getMyActiveAuctions"]);
  });

  it("lets go of every subscription and the socket when it unmounts", () => {
    const { unmount } = renderHook(() => useAuctionWebSocket({ enabled: true }));
    unmount();
    expect(client.unsubscribe.mock.calls.map(([type]) => type).sort()).toEqual([
      "auction_complete",
      "auction_created",
      "bid",
    ]);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it("stays off while disabled", () => {
    renderHook(() => useAuctionWebSocket({ enabled: false }));
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.listeners.size).toBe(0);
  });
});
