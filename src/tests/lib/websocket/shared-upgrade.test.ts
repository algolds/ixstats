/** @jest-environment node */
/**
 * server.mjs and ws-backend.mjs attach the ThinkPages Socket.IO server (/ws/thinkpages) and the market `ws` server
 * (/api/market-ws) to one HTTP server. A `ws` server attached with `{ server, path }` answers every other path's
 * upgrade with 400, which broke Socket.IO's websocket transport; the market server now takes only its own path. It
 * also refuses foreign browser origins, holds a connection cap, and keeps the bidder's user id out of bid broadcasts.
 */
import { createServer, type Server as HTTPServer } from "http";
import type { AddressInfo } from "net";
import { io as connectClient, type Socket as ClientSocket } from "socket.io-client";
import { WebSocket } from "ws";
import { ThinkPagesWebSocketServer } from "~/lib/websocket/thinkpages-websocket-server";
import {
  getMarketWebSocketServer,
  initializeMarketWebSocket,
} from "~/lib/websocket/market-websocket-server";

jest.mock("@clerk/backend", () => ({
  verifyToken: jest.fn(async () => {
    throw new Error("invalid token");
  }),
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/market-broadcast-bridge", () => ({
  startMarketBroadcastSubscriber: () => null,
}));

const env = process.env as Record<string, string | undefined>;
const savedEnv = { NODE_ENV: env.NODE_ENV, WS_ALLOWED_ORIGINS: env.WS_ALLOWED_ORIGINS };

let httpServer: HTTPServer;
let thinkPages: ThinkPagesWebSocketServer;
let port: number;
const sockets: ClientSocket[] = [];
const marketClients: WebSocket[] = [];

/** Opens a market socket; resolves with it once open, or with the HTTP status that refused it. */
function openMarket(origin?: string): Promise<{ ws: WebSocket } | { status: number }> {
  const ws = new WebSocket(`ws://localhost:${port}/api/market-ws`, {
    headers: origin ? { origin } : {},
  });
  marketClients.push(ws);
  // From the start: the welcome message can arrive before the caller listens
  received.set(ws, []);
  ws.on("message", (raw: Buffer) => received.get(ws)!.push(JSON.parse(raw.toString())));
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve({ ws }));
    // With a listener, ws leaves the refused request to the caller
    ws.once("unexpected-response", (req, res) => {
      resolve({ status: res.statusCode ?? 0 });
      req.destroy();
    });
    ws.once("error", reject);
  });
}

const received = new Map<WebSocket, Array<Record<string, unknown>>>();

async function nextMessage(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  for (;;) {
    const message = received.get(ws)!.find((m) => m.type === type);
    if (message) return message;
    await new Promise((resolve) => ws.once("message", resolve));
  }
}

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  env.NODE_ENV = "test";
  env.WS_ALLOWED_ORIGINS = "https://ixwiki.com";
  httpServer = createServer();
  // The order ws-backend.mjs and server.mjs use: Socket.IO first, then the market server.
  thinkPages = new ThinkPagesWebSocketServer(httpServer, {});
  initializeMarketWebSocket(httpServer, "/api/market-ws", { maxConnections: 2 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  for (const ws of marketClients.splice(0)) ws.terminate();
});

afterAll(async () => {
  await getMarketWebSocketServer()?.shutdown();
  await thinkPages.shutdown();
  // engine.io arms a 1 s timer on each upgrade for another path (it ends the socket if nothing answered it)
  await new Promise((resolve) => setTimeout(resolve, 1100));
  env.NODE_ENV = savedEnv.NODE_ENV;
  env.WS_ALLOWED_ORIGINS = savedEnv.WS_ALLOWED_ORIGINS;
  jest.restoreAllMocks();
});

describe("one HTTP server, two websocket servers", () => {
  it("lets a Socket.IO client connect over the websocket transport alone", async () => {
    const socket = connectClient(`http://localhost:${port}`, {
      path: "/ws/thinkpages",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      auth: { anonymous: true },
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });
    expect(socket.io.engine.transport.name).toBe("websocket");
  });

  it("opens a market socket on /api/market-ws", async () => {
    const result = await openMarket();
    expect("ws" in result).toBe(true);
    if ("ws" in result) {
      const welcome = await nextMessage(result.ws, "connected");
      expect(welcome.type).toBe("connected");
    }
  });
});

describe("the market socket", () => {
  it("refuses a browser origin outside the allow-list, and accepts one on it", async () => {
    expect(await openMarket("https://evil.example")).toEqual({ status: 403 });
    expect("ws" in (await openMarket("https://ixwiki.com"))).toBe(true);
  });

  it("refuses connections past the cap with 503", async () => {
    const first = await openMarket();
    const second = await openMarket();
    expect("ws" in first && "ws" in second).toBe(true);
    expect(await openMarket()).toEqual({ status: 503 });
  });

  it("broadcasts a bid without the bidder's internal user id", async () => {
    const result = await openMarket();
    if (!("ws" in result)) throw new Error("market socket refused");
    const bid = nextMessage(result.ws, "bid");
    getMarketWebSocketServer()!.broadcast({
      type: "bid",
      data: { id: "b1", auctionId: "a1", bidderId: "user_internal", bidderName: "Someone", amount: 5 },
    });
    expect((await bid).data).toEqual({ id: "b1", auctionId: "a1", bidderName: "Someone", amount: 5 });
  });
});
