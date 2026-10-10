/** @jest-environment node */
import { createServer, type Server as HTTPServer } from "http";
import type { AddressInfo } from "net";
import { io as connectClient, type Socket as ClientSocket } from "socket.io-client";
import {
  ThinkPagesWebSocketServer,
  parseChannel,
  type ThinkPagesServerOptions,
} from "~/lib/websocket/thinkpages-websocket-server";
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";

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
  it("lets a connection without a token in as an anonymous reader", async () => {
    await expect(connected(connect())).resolves.toBeUndefined();
  });

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

  it("rejects malformed channels", async () => {
    const client = connect("token-a");
    await connected(client);
    const refused = nextEvent<{ reason: string }>(client, "subscribe:error");
    client.emit("subscribe", { channel: "country:c1" });
    expect(await refused).toEqual({ channel: "country:c1", reason: "invalid_channel" });
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

describe("parseChannel", () => {
  it.each([
    ["conversation:c1", { kind: "conversation", id: "c1" }],
    ["group:g_1", { kind: "group", id: "g_1" }],
    ["realm-board:r-eurth", { kind: "realm-board", id: "r-eurth" }],
  ])("reads %s", (channel, expected) => {
    expect(parseChannel(channel)).toEqual(expected);
  });

  it.each([
    "country:c1",
    "realm-board:",
    "realm-board:a:b",
    "realm-board:a b",
    `realm-board:${"x".repeat(65)}`,
    "",
    "conversation",
  ])("refuses %j", (channel) => {
    expect(parseChannel(channel)).toBeNull();
  });
});

describe("ThinkPagesWebSocketServer anonymous readers", () => {
  it("lets a signed-out reader join a visible realm's board room and receive its events", async () => {
    const reader = connect();
    await connected(reader);
    const presence = nextEvent<BoardLiveEvent>(reader, "board:presence");
    reader.emit("subscribe", { channel: "realm-board:r_pub" });
    expect(await presence).toEqual({ type: "board:presence", realmId: "r_pub", count: 1 });
    expect(canJoinRealmBoard).toHaveBeenCalledWith(null, "r_pub");

    const message = nextEvent<BoardLiveEvent>(reader, "board:message");
    const event: BoardLiveEvent = {
      type: "board:message",
      realmId: "r_pub",
      message: {
        id: "p1",
        authorUserId: null,
        authorPersonaId: null,
        importedAuthorName: null,
        author: { name: "n", handle: null, avatarUrl: null, flagUrl: null, persona: false },
        role: null,
        isVisitor: false,
        visitorRealm: null,
        contentHtml: "<p>hi</p>",
        createdAt: "2026-10-10T12:00:00.000Z",
        editedAt: null,
        replyTo: null,
        continued: null,
      },
    };
    wsServer.broadcastBoard(event);
    expect(await message).toEqual(event);
  });

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

  it("asks the check once per room", async () => {
    const reader = connect();
    await connected(reader);
    const first = nextEvent(reader, "board:presence");
    reader.emit("subscribe", { channel: "realm-board:r_pub" });
    await first;
    const again = nextEvent(reader, "board:presence");
    reader.emit("subscribe", { channel: "realm-board:r_pub" });
    await again;
    expect(canJoinRealmBoard).toHaveBeenCalledTimes(1);
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

  it("shares a join in flight with a repeat of the same room, and reports a refusal to both", async () => {
    const reader = connect();
    await connected(reader);
    const refusals: string[] = [];
    reader.on("subscribe:error", (e: { channel: string }) => refusals.push(e.channel));
    for (let i = 0; i < 3; i += 1) reader.emit("subscribe", { channel: "realm-board:r_draft" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(refusals).toEqual(Array(3).fill("realm-board:r_draft"));
    expect(canJoinRealmBoard).toHaveBeenCalledTimes(1);
  });

  it("starts no presence work for an unsubscribe from a room the socket is not in, or a bad name", async () => {
    const inside = connect("token-a");
    const outsider = connect("token-b");
    await Promise.all([connected(inside), connected(outsider)]);
    inside.emit("subscribe", { channel: "realm-board:r_pub" });
    await nextEvent(inside, "board:presence");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const silent = silentFor(inside, "board:presence", 250);
    outsider.emit("unsubscribe", { channel: "realm-board:r_pub" });
    outsider.emit("unsubscribe", { channel: "realm-board:not a room" });
    expect(await silent).toBe(true);
    // A real leave still updates the room.
    const update = nextEvent<{ count: number }>(inside, "board:presence");
    outsider.emit("subscribe", { channel: "realm-board:r_pub" });
    await update;
    const left = nextEvent<{ count: number }>(inside, "board:presence");
    outsider.emit("unsubscribe", { channel: "realm-board:r_pub" });
    expect((await left).count).toBe(1);
  });

  it("caps the board rooms one socket reads at once", async () => {
    const reader = connect();
    await connected(reader);
    const refusals: string[] = [];
    reader.on("subscribe:error", (e: { channel: string }) => refusals.push(e.channel));
    for (let i = 1; i <= 6; i += 1) {
      reader.emit("subscribe", { channel: `realm-board:r_pub${i}` });
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(refusals).toEqual(["realm-board:r_pub6"]);
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

  it("does not echo typing back to the typist", async () => {
    const { typist } = await pair();
    const silent = silentFor(typist, "board:typing", 250);
    typist.emit("board:typing", { realmId: "r_pub" });
    expect(await silent).toBe(true);
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

  it("relays at most one event per second per user per room", async () => {
    const { typist, watcher } = await pair();
    const seen: string[] = [];
    watcher.on("board:typing", (event: { name: string }) => seen.push(event.name));
    for (let i = 0; i < 5; i += 1) typist.emit("board:typing", { realmId: "r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(seen).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 900));
    typist.emit("board:typing", { realmId: "r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(seen).toHaveLength(2);
  });

  it("relays no typing from a user who may not post, and asks the forum once per room", async () => {
    const { watcher } = await pair();
    const banned = connect("token-banned");
    await connected(banned);
    banned.emit("subscribe", { channel: "realm-board:r_pub" });
    await nextEvent(banned, "board:presence");
    const silent = silentFor(watcher, "board:typing", 250);
    banned.emit("board:typing", { realmId: "r_pub" });
    expect(await silent).toBe(true);
    expect(canTypeOnBoard).toHaveBeenCalledWith("user_banned", "r_pub");
    expect(boardTypingName).not.toHaveBeenCalled();
  });

  it("caches the right to type for the socket, so typing does not query on every event", async () => {
    const { typist, watcher } = await pair();
    const seen: string[] = [];
    watcher.on("board:typing", (e: { name: string }) => seen.push(e.name));
    typist.emit("board:typing", { realmId: "r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    typist.emit("board:typing", { realmId: "r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(seen).toHaveLength(2);
    expect(canTypeOnBoard).toHaveBeenCalledTimes(1);
  });

  it("relays no typing at all when the server was given no typing check", async () => {
    const bare = createServer();
    const bareWs = new ThinkPagesWebSocketServer(bare, {
      canJoinRealmBoard,
      boardTypingName,
      presenceDelayMs: 20,
    });
    await new Promise<void>((resolve) => bare.listen(0, resolve));
    const bareUrl = `http://localhost:${(bare.address() as AddressInfo).port}`;
    const open = (token: string) => {
      const c = connectClient(bareUrl, {
        path: "/ws/thinkpages",
        transports: ["websocket"],
        reconnection: false,
        forceNew: true,
        auth: { token },
      });
      clients.push(c);
      return c;
    };
    const [typist, watcher] = [open("token-a"), open("token-b")];
    await Promise.all([connected(typist), connected(watcher)]);
    typist.emit("subscribe", { channel: "realm-board:r_pub" });
    watcher.emit("subscribe", { channel: "realm-board:r_pub" });
    await Promise.all([nextEvent(typist, "board:presence"), nextEvent(watcher, "board:presence")]);
    const silent = silentFor(watcher, "board:typing", 250);
    typist.emit("board:typing", { realmId: "r_pub" });
    expect(await silent).toBe(true);
    typist.disconnect();
    watcher.disconnect();
    await bareWs.shutdown();
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

describe("ThinkPagesWebSocketServer board presence", () => {
  it("counts distinct signed-in users and each anonymous socket, and follows joins and leaves", async () => {
    const first = connect("token-a");
    const sameUser = connect("token-a");
    const anon = connect();
    await Promise.all([connected(first), connected(sameUser), connected(anon)]);
    const counts: number[] = [];
    first.on("board:presence", (e: { count: number }) => counts.push(e.count));

    first.emit("subscribe", { channel: "realm-board:r_pub" });
    await nextEvent(first, "board:presence");
    sameUser.emit("subscribe", { channel: "realm-board:r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(counts.at(-1)).toBe(1);

    anon.emit("subscribe", { channel: "realm-board:r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(counts.at(-1)).toBe(2);

    anon.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(counts.at(-1)).toBe(1);
  });

  it("coalesces a burst of joins into few events", async () => {
    const watcher = connect("token-b");
    await connected(watcher);
    watcher.emit("subscribe", { channel: "realm-board:r_pub" });
    await nextEvent(watcher, "board:presence");
    const counts: number[] = [];
    watcher.on("board:presence", (e: { count: number }) => counts.push(e.count));
    const crowd = Array.from({ length: 6 }, () => connect());
    await Promise.all(crowd.map(connected));
    for (const client of crowd) client.emit("subscribe", { channel: "realm-board:r_pub" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(counts.at(-1)).toBe(7);
    expect(counts.length).toBeLessThan(6);
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
