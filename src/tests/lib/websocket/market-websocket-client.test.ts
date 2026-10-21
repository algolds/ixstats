import { getMarketWebSocketClient } from "~/lib/websocket/market-websocket-client";

/** Just enough of a browser WebSocket for the client to connect and receive. */
class FakeSocket {
  static readonly OPEN = 1;
  static last: FakeSocket | null = null;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = jest.fn();
  send = jest.fn();
  constructor() {
    FakeSocket.last = this;
  }
}

const receive = (type: string, data: object) =>
  FakeSocket.last?.onmessage?.({ data: JSON.stringify({ type, data }) });

beforeAll(() => {
  Object.defineProperty(window, "WebSocket", { value: FakeSocket, writable: true });
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

describe("market WebSocket client", () => {
  it("hands every event of a type to an unfiltered subscriber until it unsubscribes", () => {
    const client = getMarketWebSocketClient();
    const onBid = jest.fn();
    const off = client.subscribeToAll("bid", onBid);
    client.connect();

    receive("bid", { auctionId: "a1" });
    receive("bid", { auctionId: "a2" });
    receive("auction_created", { id: "a3" });
    expect(onBid).toHaveBeenCalledTimes(2);

    off();
    receive("bid", { auctionId: "a4" });
    expect(onBid).toHaveBeenCalledTimes(2);
  });
});
