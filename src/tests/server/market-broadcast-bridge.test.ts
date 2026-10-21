import {
  MARKET_BROADCAST_CHANNEL,
  startMarketBroadcastSubscriber,
  type MarketBroadcastMessage,
} from "~/server/market-broadcast-bridge";
import type { BroadcastSubscriber } from "~/server/thinkpages-broadcast-bridge";

const bid: MarketBroadcastMessage = { type: "bid", data: { auctionId: "a1", amount: 50 } };

describe("market broadcast bridge", () => {
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
