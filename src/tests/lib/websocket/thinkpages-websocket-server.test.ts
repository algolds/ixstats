/** @jest-environment node */
import { createServer, type Server as HTTPServer } from "http";
import type { AddressInfo } from "net";
import { io as connectClient, type Socket as ClientSocket } from "socket.io-client";
import {
  ThinkPagesWebSocketServer,
  type ThinkPagesServerOptions,
} from "~/lib/websocket/thinkpages-websocket-server";
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import type { Socket } from "socket.io";
import { RealmBoardRooms } from "~/lib/websocket/realm-board-room";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-websocket-server";
import {
  THINKPAGES_BROADCAST_CHANNEL,
  publishBoardEvent,
  redisThinkPagesBroadcaster,
  startThinkPagesBroadcastSubscriber,
  type BroadcastPublisher,
  type BroadcastSubscriber,
  type MessageBroadcaster,
} from "~/server/thinkpages-broadcast-bridge";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";

const mockTokens: Record<string, string> = {
  "token-a": "user_a",
  "token-b": "user_b",
  "token-banned": "user_banned",
};

jest.mock("@clerk/backend", () => ({
  verifyToken: jest.fn(async (token: string) => {
    const sub = mockTokens[token];
    if (!sub) throw new Error("invalid token");
    return { sub };
  }),
}));

// conversation "conv1" has only user_a as an active participant
jest.mock("~/server/db", () => ({
  db: {
    conversationParticipant: {
      findFirst: jest.fn(async (args: { where: { conversationId: string; userId: string } }) =>
        args.where.conversationId === "conv1" && args.where.userId === "user_a"
          ? { id: "p1" }
          : null
      ),
    },
    thinktankMember: { findFirst: jest.fn(async () => null) },
  },
}));

const env = process.env as Record<string, string | undefined>;
const savedEnv = { NODE_ENV: env.NODE_ENV, CLERK_SECRET_KEY: env.CLERK_SECRET_KEY };

/** The forum's checks, as `initializeWebSocketServer` injects them: r_pub is visible to all, r_draft to nobody here. */
const canJoinRealmBoard = jest.fn(async (_clerkUserId: string | null, realmId: string) =>
  realmId.startsWith("r_pub")
);
/** Banned users and visitors of a visitors-off board are the ones the forum refuses. */
const canTypeOnBoard = jest.fn(
  async (clerkUserId: string, _realmId: string) => clerkUserId !== "user_banned"
);
const boardTypingName = jest.fn(async (clerkUserId: string, personaId: string | null) =>
  personaId ? (personaId === "pa_own" ? "Persona Name" : null) : `Handle of ${clerkUserId}`
);
const serverOptions = (): ThinkPagesServerOptions => ({
  canJoinRealmBoard,
  canTypeOnBoard,
  boardTypingName,
  presenceDelayMs: 20,
});

let httpServer: HTTPServer;
let wsServer: ThinkPagesWebSocketServer;
let url: string;
const clients: ClientSocket[] = [];

function connect(token?: string, origin?: string): ClientSocket {
  const client = connectClient(url, {
    path: "/ws/thinkpages",
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: token ? { token } : { anonymous: true },
    extraHeaders: origin ? { origin } : undefined,
  });
  clients.push(client);
  return client;
}

function nextEvent<T>(client: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => client.once(event, (data: T) => resolve(data)));
}

function connected(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
}

function silentFor(client: ClientSocket, event: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onEvent = () => resolve(false);
    client.once(event, onEvent);
    setTimeout(() => {
      client.off(event, onEvent);
      resolve(true);
    }, ms);
  });
}

beforeEach(async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  env.NODE_ENV = "test";
  env.CLERK_SECRET_KEY = "sk_test_secret";
  httpServer = createServer();
  canJoinRealmBoard.mockClear();
  boardTypingName.mockClear();
  canTypeOnBoard.mockClear();
  wsServer = new ThinkPagesWebSocketServer(httpServer, serverOptions());
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await wsServer.shutdown();
  jest.restoreAllMocks();
});

afterAll(() => {
  env.NODE_ENV = savedEnv.NODE_ENV;
  env.CLERK_SECRET_KEY = savedEnv.CLERK_SECRET_KEY;
});

describe("ThinkPagesWebSocketServer handshake", () => {
  it("refuses a handshake with no token that does not say it is anonymous", async () => {
    for (const auth of [{}, { token: "" }, { anonymous: false }]) {
      const client = connectClient(url, {
        path: "/ws/thinkpages",
        transports: ["websocket"],
        reconnection: false,
        forceNew: true,
        auth,
      });
      clients.push(client);
      const error = await nextEvent<Error>(client, "connect_error");
      expect(error.message).toBe("unauthorized");
    }
  });

  it("rejects an invalid token", async () => {
    const error = await nextEvent<Error>(connect("garbage"), "connect_error");
    expect(error.message).toBe("unauthorized");
  });

  it("rejects a disallowed browser origin in production", async () => {
    env.NODE_ENV = "production";
    await expect(connected(connect("token-a", "https://evil.example"))).rejects.toBeDefined();
  });
});

describe("ThinkPagesWebSocketServer rooms", () => {
  it("refuses a conversation the user is not a participant of", async () => {
    const outsider = connect("token-b");
    await connected(outsider);
    const refused = nextEvent<{ reason: string }>(outsider, "subscribe:error");
    outsider.emit("subscribe", { channel: "conversation:conv1" });
    expect(await refused).toEqual({ channel: "conversation:conv1", reason: "forbidden" });

    const silent = silentFor(outsider, "message:update", 200);
    wsServer.broadcastMessage({
      type: "message:new",
      conversationId: "conv1",
      messageId: "m1",
      accountId: "user_a",
      content: "secret",
      timestamp: Date.now(),
    });
    expect(await silent).toBe(true);
  });
  it("lets a participant join, stamps its own id on typing, and delivers messages", async () => {
    const member = connect("token-a");
    await connected(member);
    member.emit("subscribe", { channel: "conversation:conv1" });

    // typing is relayed only once the join completed, carrying the verified id
    const typing = nextEvent<{ accountId: string }>(member, "typing:update");
    const sendTyping = setInterval(
      () =>
        member.emit("typing:update", {
          accountId: "spoofed",
          conversationId: "conv1",
          isTyping: true,
        }),
      20
    );
    const relayed = await typing;
    clearInterval(sendTyping);
    expect(relayed.accountId).toBe("user_a");

    const update = nextEvent<{ data: { content: string } }>(member, "message:update");
    wsServer.broadcastMessage({
      type: "message:new",
      conversationId: "conv1",
      messageId: "m1",
      accountId: "user_a",
      content: "hello",
      timestamp: Date.now(),
    });
    expect((await update).data.content).toBe("hello");
  });
});
describe("ThinkPagesWebSocketServer anonymous readers", () => {
  it("refuses a realm the check refuses (a draft or hidden realm)", async () => {
    const reader = connect();
    await connected(reader);
    const refused = nextEvent<{ reason: string }>(reader, "subscribe:error");
    reader.emit("subscribe", { channel: "realm-board:r_draft" });
    expect(await refused).toEqual({ channel: "realm-board:r_draft", reason: "forbidden" });

    const silent = silentFor(reader, "board:updated", 200);
    wsServer.broadcastBoard({
      type: "board:updated",
      realmId: "r_draft",
      change: { type: "removed", postId: "p1" },
    });
    expect(await silent).toBe(true);
  });

  it("answers a failing join check with the forbidden refusal and keeps the server alive", async () => {
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
    // The room adapter failing mid-join is the rejection the checks' own catches do not cover.
    const rooms = (wsServer as never as { boardRooms: { join: () => Promise<boolean> } })
      .boardRooms;
    jest.spyOn(rooms, "join").mockRejectedValueOnce(new Error("adapter is down"));
    const reader = connect();
    await connected(reader);
    const refused = nextEvent<{ reason: string }>(reader, "subscribe:error");
    reader.emit("subscribe", { channel: "realm-board:r_pub" });
    expect(await refused).toEqual({ channel: "realm-board:r_pub", reason: "forbidden" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off("unhandledRejection", unhandled);
    errors.mockRestore();
    expect(unhandled).not.toHaveBeenCalled();
    expect(reader.connected).toBe(true);
  });

  it("refuses an anonymous reader every room that is not a board room, without asking the database", async () => {
    const reader = connect();
    await connected(reader);
    for (const channel of ["conversation:conv1", "group:g1"]) {
      const refused = nextEvent<{ reason: string }>(reader, "subscribe:error");
      reader.emit("subscribe", { channel });
      expect(await refused).toEqual({ channel, reason: "forbidden" });
    }
  });

  it("refuses every realm board room when the server was given no join check", async () => {
    const bare = createServer();
    const bareWs = new ThinkPagesWebSocketServer(bare);
    await new Promise<void>((resolve) => bare.listen(0, resolve));
    const reader = connectClient(`http://localhost:${(bare.address() as AddressInfo).port}`, {
      path: "/ws/thinkpages",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      auth: { anonymous: true },
    });
    clients.push(reader);
    await connected(reader);
    const refused = nextEvent<{ reason: string }>(reader, "subscribe:error");
    reader.emit("subscribe", { channel: "realm-board:r_pub" });
    expect(await refused).toEqual({ channel: "realm-board:r_pub", reason: "forbidden" });
    reader.disconnect();
    await bareWs.shutdown();
  });
  it("holds a burst of subscribes to the cap and to one check per room, however fast they come", async () => {
    const reader = connect();
    await connected(reader);
    const refusals: string[] = [];
    reader.on("subscribe:error", (e: { channel: string }) => refusals.push(e.channel));
    for (let i = 1; i <= 20; i += 1) reader.emit("subscribe", { channel: `realm-board:r_pub${i}` });
    for (let i = 0; i < 20; i += 1) reader.emit("subscribe", { channel: "realm-board:r_pub1" });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(refusals).toHaveLength(15);
    expect(canJoinRealmBoard).toHaveBeenCalledTimes(5);
    const rooms = canJoinRealmBoard.mock.calls.map(([, realmId]) => realmId);
    expect(new Set(rooms).size).toBe(5);
  });
  it("ignores typing, presence and receipts from an anonymous reader", async () => {
    const member = connect("token-a");
    const reader = connect();
    await Promise.all([connected(member), connected(reader)]);
    member.emit("subscribe", { channel: "realm-board:r_pub" });
    reader.emit("subscribe", { channel: "realm-board:r_pub" });
    await nextEvent(reader, "board:presence");

    const silent = silentFor(member, "board:typing", 250);
    reader.emit("board:typing", { realmId: "r_pub" });
    reader.emit("typing:update", { conversationId: "conv1", isTyping: true });
    expect(await silent).toBe(true);
    expect(boardTypingName).not.toHaveBeenCalled();
  });
});

describe("ThinkPagesWebSocketServer board typing", () => {
  async function pair(): Promise<{ typist: ClientSocket; watcher: ClientSocket }> {
    const typist = connect("token-a");
    const watcher = connect("token-b");
    await Promise.all([connected(typist), connected(watcher)]);
    const joined = [nextEvent(typist, "board:presence"), nextEvent(watcher, "board:presence")];
    typist.emit("subscribe", { channel: "realm-board:r_pub" });
    watcher.emit("subscribe", { channel: "realm-board:r_pub" });
    await Promise.all(joined);
    return { typist, watcher };
  }

  it("relays the server-resolved name to the others in the room, never the client's", async () => {
    const { typist, watcher } = await pair();
    const typing = nextEvent<BoardLiveEvent>(watcher, "board:typing");
    typist.emit("board:typing", { realmId: "r_pub", name: "Spoofed", accountId: "user_b" });
    expect(await typing).toEqual({
      type: "board:typing",
      realmId: "r_pub",
      name: "Handle of user_a",
    });
    expect(boardTypingName).toHaveBeenCalledWith("user_a", null);
  });
  it("uses a persona's own name, and drops a persona that is not the user's", async () => {
    const { typist, watcher } = await pair();
    const typing = nextEvent<{ name: string }>(watcher, "board:typing");
    typist.emit("board:typing", { realmId: "r_pub", personaId: "pa_own" });
    expect((await typing).name).toBe("Persona Name");

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const silent = silentFor(watcher, "board:typing", 250);
    typist.emit("board:typing", { realmId: "r_pub", personaId: "pa_other" });
    expect(await silent).toBe(true);
  });
  it("ignores typing for a room the socket has not joined", async () => {
    const { watcher } = await pair();
    const stranger = connect("token-a");
    await connected(stranger);
    const silent = silentFor(watcher, "board:typing", 250);
    stranger.emit("board:typing", { realmId: "r_pub" });
    expect(await silent).toBe(true);
  });
});
describe("ThinkPagesWebSocketServer board broadcasts", () => {
  it("delivers a board event only to the realm's room", async () => {
    const inside = connect("token-a");
    const outside = connect("token-b");
    await Promise.all([connected(inside), connected(outside)]);
    inside.emit("subscribe", { channel: "realm-board:r_pub" });
    await nextEvent(inside, "board:presence");
    const update = nextEvent<BoardLiveEvent>(inside, "board:settings");
    const silent = silentFor(outside, "board:settings", 250);
    const event: BoardLiveEvent = {
      type: "board:settings",
      realmId: "r_pub",
      settings: { visitorsAllowed: false, slowModeSeconds: 10 },
    };
    wsServer.broadcastBoard(event);
    expect(await update).toEqual(event);
    expect(await silent).toBe(true);
  });
});

describe("RealmBoardRooms typing caches and logging", () => {
  const emitted: object[] = [];
  const socket = {
    rooms: new Set(["realm-board:r1"]),
    connected: true,
    to: () => ({ emit: (_name: string, event: object) => emitted.push(event) }),
  } as unknown as Socket;
  let now: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let clock = 1_000_000;

  beforeEach(() => {
    emitted.length = 0;
    clock = 1_000_000;
    now = jest.spyOn(Date, "now").mockImplementation(() => clock);
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    now.mockRestore();
    warn.mockRestore();
  });

  it("asks for the typing name again after 30 seconds, so a revoked persona stops", async () => {
    const boardTypingName = jest.fn(async () => "Persona Name");
    const rooms = new RealmBoardRooms({} as never, () => null, {
      canTypeOnBoard: async () => true,
      boardTypingName,
    });
    await rooms.relayTyping(socket, "u1", { realmId: "r1", personaId: "pa1" });
    clock += 1_500;
    await rooms.relayTyping(socket, "u1", { realmId: "r1", personaId: "pa1" });
    expect(boardTypingName).toHaveBeenCalledTimes(1);
    clock += 30_000;
    boardTypingName.mockResolvedValueOnce(null as never);
    await rooms.relayTyping(socket, "u1", { realmId: "r1", personaId: "pa1" });
    expect(boardTypingName).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(2);
  });

  it("logs a failing check instead of swallowing it, and refuses", async () => {
    const rooms = new RealmBoardRooms({} as never, () => null, {
      canTypeOnBoard: async () => {
        throw new Error("db down");
      },
      canJoinRealmBoard: async () => {
        throw new Error("db down");
      },
      boardTypingName: async () => {
        throw new Error("db down");
      },
    });
    await rooms.relayTyping(socket, "u1", { realmId: "r1" });
    expect(emitted).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[RealmBoardRooms] typing rights check failed:", "db down");
    await expect(rooms.join(socket, null, "r2")).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith("[RealmBoardRooms] join check failed:", "db down");
    const open = new RealmBoardRooms({} as never, () => null, {
      canTypeOnBoard: async () => true,
      boardTypingName: async () => {
        throw new Error("db down");
      },
    });
    clock += 1_500;
    await open.relayTyping(socket, "u1", { realmId: "r1" });
    expect(emitted).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[RealmBoardRooms] typing name check failed:", "db down");
  });
});

describe("the broadcast bridge between processes", () => {
  type Listener = (channel: string, message: string) => void;
  /** In-memory stand-in for a Redis server: one publisher, one subscriber connection. */
  function createFakeRedis(status = "ready") {
    const listeners: Listener[] = [];
    const channels = new Set<string>();
    const publisher: BroadcastPublisher = {
      status,
      publish: jest.fn(async (channel: string, message: string) => {
        if (!channels.has(channel)) return 0;
        for (const listener of listeners) listener(channel, message);
        return listeners.length;
      }),
    };
    const subscriber: BroadcastSubscriber = {
      subscribe: jest.fn(async (channel: string) => {
        channels.add(channel);
      }),
      onMessage: (listener: Listener) => {
        listeners.push(listener);
      },
      quit: jest.fn(async () => undefined),
    };
    const deliver = (channel: string, message: string) => {
      for (const listener of listeners) listener(channel, message);
    };
    return { publisher, subscriber, deliver };
  }
  function fakeServer(): MessageBroadcaster & {
    broadcastMessage: jest.Mock;
    broadcastBoard: jest.Mock;
  } {
    return { broadcastMessage: jest.fn(), broadcastBoard: jest.fn() };
  }
  const event: ThinkPagesMessageEvent = {
    type: "message:new",
    conversationId: "conv1",
    messageId: "msg1",
    accountId: "user_a",
    content: "hello",
    timestamp: 1700000000000,
  };
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
  });
  describe("ThinkPages broadcast bridge", () => {
    it("ignores other channels, malformed JSON and events of the wrong shape", () => {
      const redis = createFakeRedis();
      const server = fakeServer();
      startThinkPagesBroadcastSubscriber(server, redis.subscriber);

      redis.deliver("some:other:channel", JSON.stringify(event));
      redis.deliver(THINKPAGES_BROADCAST_CHANNEL, "{not json");
      redis.deliver(THINKPAGES_BROADCAST_CHANNEL, JSON.stringify({ type: "notification:new" }));

      expect(server.broadcastMessage).not.toHaveBeenCalled();
    });

    describe("realm board events", () => {
      const boardEvent: BoardLiveEvent = {
        type: "board:updated",
        realmId: "r_eurth",
        change: { type: "removed", postId: "p1" },
      };

      it("round trips a board event to broadcastBoard, not broadcastMessage", () => {
        const redis = createFakeRedis();
        const server = fakeServer();
        startThinkPagesBroadcastSubscriber(server, redis.subscriber);

        publishBoardEvent(boardEvent, redis.publisher);

        expect(redis.publisher.publish).toHaveBeenCalledWith(
          THINKPAGES_BROADCAST_CHANNEL,
          JSON.stringify(boardEvent)
        );
        expect(server.broadcastBoard).toHaveBeenCalledWith(boardEvent);
        expect(server.broadcastMessage).not.toHaveBeenCalled();
      });
    });
    it("routes through Redis when this process hosts no Socket.IO server", () => {
      expect(getThinkPagesBroadcaster()).toBe(redisThinkPagesBroadcaster);
    });
  });
});
