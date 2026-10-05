import {
  MARKET_BROADCAST_CHANNEL,
  publishMarketEvent,
  startMarketBroadcastSubscriber,
  type MarketBroadcastMessage,
} from "~/server/market-broadcast-bridge";
import type { BroadcastSubscriber } from "~/server/thinkpages-broadcast-bridge";

const bid: MarketBroadcastMessage = { type: "bid", data: { auctionId: "a1", amount: 50 } };

describe("market broadcast bridge", () => {
  it("publishes to Redis and leaves local delivery to this process's subscriber", () => {
    const publish = jest.fn().mockResolvedValue(1);
    const local = { broadcast: jest.fn() };

    publishMarketEvent(bid, local, { status: "ready", publish });

    expect(publish).toHaveBeenCalledWith(MARKET_BROADCAST_CHANNEL, JSON.stringify(bid));
    expect(local.broadcast).not.toHaveBeenCalled();
  });

  it("delivers locally when Redis is unavailable", () => {
    const local = { broadcast: jest.fn() };
    publishMarketEvent(bid, local, null);
    expect(local.broadcast).toHaveBeenCalledWith(bid);
  });

  it("falls back to local delivery when the publish fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const local = { broadcast: jest.fn() };
    publishMarketEvent(bid, local, {
      status: "ready",
      publish: jest.fn().mockRejectedValue(new Error("down")),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(local.broadcast).toHaveBeenCalledWith(bid);
    warn.mockRestore();
  });

  it("re-emits valid published events and ignores other channels and junk", () => {
    let listener!: (channel: string, raw: string) => void;
    const subscriber: BroadcastSubscriber = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      onMessage: (fn) => (listener = fn),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const server = { broadcast: jest.fn() };

    startMarketBroadcastSubscriber(server, subscriber);
    listener(MARKET_BROADCAST_CHANNEL, JSON.stringify(bid));
    listener("ixstats:thinkpages:broadcast", JSON.stringify(bid));
    listener(MARKET_BROADCAST_CHANNEL, '{"type":"drop_tables"}');
    listener(MARKET_BROADCAST_CHANNEL, "not json");

    expect(subscriber.subscribe).toHaveBeenCalledWith(MARKET_BROADCAST_CHANNEL);
    expect(server.broadcast).toHaveBeenCalledTimes(1);
    expect(server.broadcast).toHaveBeenCalledWith(bid);
  });
});
