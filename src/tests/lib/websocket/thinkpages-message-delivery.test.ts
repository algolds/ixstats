/** @jest-environment node */
import { createServer, type Server as HTTPServer } from "http";
import type { AddressInfo } from "net";
import { io as connectClient, type Socket as ClientSocket } from "socket.io-client";
import { ThinkPagesWebSocketServer } from "~/lib/websocket/thinkpages-websocket-server";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-types";
import {
  THINKPAGES_BROADCAST_CHANNEL,
  startThinkPagesBroadcastSubscriber,
  type BroadcastSubscriber,
  type MessageBroadcaster,
} from "~/server/thinkpages-broadcast-bridge";

const mockTokens: Record<string, string> = {
  "token-a": "user_a",
  "token-b": "user_b",
  "token-c": "user_c",
};
jest.mock("@clerk/backend", () => ({
  verifyToken: jest.fn(async (token: string) => {
    const sub = mockTokens[token];
    if (!sub) throw new Error("invalid token");
    return { sub };
  }),
}));

/** Members of conv1 and their request status; conv1 can also be a realm board's chat. */
const mockMembers = new Map<string, string>();
const mockConversation: { source: string | null; sourceId: string | null } = {
  source: null,
  sourceId: null,
};
type StatusFilter = { notIn?: string[] };
const allowed = (userId: string, filter?: StatusFilter) =>
  mockMembers.has(userId) && !filter?.notIn?.includes(mockMembers.get(userId)!);

jest.mock("~/server/db", () => ({
  db: {
    conversationParticipant: {
      findFirst: jest.fn(
        async (args: {
          where: { conversationId: string; userId: string; requestStatus?: StatusFilter };
        }) =>
          args.where.conversationId === "conv1" &&
          allowed(args.where.userId, args.where.requestStatus)
            ? { id: "p", conversation: mockConversation }
            : null
      ),
      findMany: jest.fn(
        async (args: {
          where: { conversationId: string; userId: { in: string[] }; requestStatus?: StatusFilter };
        }) =>
          args.where.conversationId === "conv1"
            ? args.where.userId.in
                .filter((id) => allowed(id, args.where.requestStatus))
                .map((userId) => ({ userId, conversation: mockConversation }))
            : []
      ),
    },
    thinktankMember: { findFirst: jest.fn(async () => null) },
  },
}));

let mockBanned = false;
jest.mock("~/server/shared/realm-board", () => ({
  getRealmBoardAccess: jest.fn(async () => ({
    restriction: mockBanned ? { kind: "ban", until: null, reason: null } : null,
  })),
}));

let mockReceiptsOff = new Set<string>();
let mockSettingFails = false;
jest.mock("~/server/shared/privacy-permissions", () => ({
  usersWithSwitchOff: jest.fn(async () => {
    if (mockSettingFails) throw new Error("db down");
    return mockReceiptsOff;
  }),
}));

const env = process.env as Record<string, string | undefined>;
const savedEnv = { NODE_ENV: env.NODE_ENV, CLERK_SECRET_KEY: env.CLERK_SECRET_KEY };

let httpServer: HTTPServer;
let wsServer: ThinkPagesWebSocketServer;
let url: string;
const clients: ClientSocket[] = [];

type RoomsAccess = { io: { sockets: { adapter: { rooms: Map<string, Set<string>> } } } };
const rooms = () => (wsServer as never as RoomsAccess).io.sockets.adapter.rooms;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectAs(token: string): Promise<ClientSocket> {
  const client = connectClient(url, {
    path: "/ws/thinkpages",
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: { token },
  });
  clients.push(client);
  // the user room is joined before "authenticated" is sent, which can arrive with "connect"
  await new Promise<void>((resolve, reject) => {
    client.once("authenticated", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}

/** A client that joined conv1 (waits until the server has it in the room). */
async function joined(token: string): Promise<ClientSocket> {
  const client = await connectAs(token);
  client.emit("subscribe", { channel: "conversation:conv1" });
  for (let i = 0; i < 100 && !rooms().get("conversation:conv1")?.has(client.id!); i += 1) {
    await sleep(10);
  }
  return client;
}

/** Collects every payload of `event` for `ms`. */
async function collect<T>(client: ClientSocket, event: string, ms: number): Promise<T[]> {
  const got: T[] = [];
  client.on(event, (data: T) => got.push(data));
  await sleep(ms);
  client.off(event);
  return got;
}

const message: ThinkPagesMessageEvent = {
  type: "message:new",
  conversationId: "conv1",
  messageId: "m1",
  accountId: "user_a",
  content: "secret",
  timestamp: 1700000000000,
};

beforeEach(async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  env.NODE_ENV = "test";
  env.CLERK_SECRET_KEY = "sk_test_secret";
  mockMembers.clear();
  for (const id of ["user_a", "user_b", "user_c"]) mockMembers.set(id, "none");
  mockConversation.source = null;
  mockConversation.sourceId = null;
  mockBanned = false;
  mockReceiptsOff = new Set();
  mockSettingFails = false;
  httpServer = createServer();
  wsServer = new ThinkPagesWebSocketServer(httpServer);
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

describe("recipientIds delivery", () => {
  it("emits only to the listed users' sockets in the room, and unwraps nothing server-side", async () => {
    const [a, b, c] = [await joined("token-a"), await joined("token-b"), await joined("token-c")];
    const heard = [a, b, c].map((s) =>
      collect<{ data: ThinkPagesMessageEvent }>(s, "message:update", 300)
    );
    const lists = [a, b, c].map((s) => collect(s, "conversation:update", 300));
    await wsServer.broadcastMessage({ ...message, recipientIds: ["user_a", "user_b"] });
    const [fromA, fromB, fromC] = await Promise.all(heard);
    await Promise.all(lists);
    expect(fromA).toHaveLength(1);
    expect(fromA![0]!.data.content).toBe("secret");
    expect(fromB).toHaveLength(1);
    expect(fromC).toHaveLength(0);
  });

  it("reaches nobody for an empty list, and the whole room when unset", async () => {
    const [a, b] = [await joined("token-a"), await joined("token-b")];
    const none = Promise.all([a, b].map((s) => collect(s, "message:update", 200)));
    await wsServer.broadcastMessage({ ...message, recipientIds: [] });
    expect((await none).flat()).toHaveLength(0);

    const all = Promise.all([a, b].map((s) => collect(s, "message:update", 200)));
    await wsServer.broadcastMessage(message);
    expect((await all).map((got) => got.length)).toEqual([1, 1]);
  });

  it("pings recipients' user rooms with the conversation id only, for threads they have not opened", async () => {
    const reader = await connectAs("token-c"); // never subscribed to conv1
    const bystander = await connectAs("token-b");
    const ping = collect<Record<string, unknown>>(reader, "inbox:update", 300);
    const other = collect(bystander, "inbox:update", 300);
    await wsServer.broadcastMessage({ ...message, recipientIds: ["user_c"] });
    const [pings, others] = [await ping, await other];
    expect(others).toHaveLength(0);
    expect(pings).toHaveLength(1);
    expect(Object.keys(pings[0]!).sort()).toEqual(["conversationId", "timestamp", "type"]);
    expect(pings[0]).toMatchObject({ type: "inbox:update", conversationId: "conv1" });
  });

  it("sends no inbox ping for an edit or a delete", async () => {
    const reader = await connectAs("token-c");
    const ping = collect(reader, "inbox:update", 250);
    await wsServer.broadcastMessage({
      ...message,
      type: "message:deleted",
      recipientIds: ["user_c"],
    });
    expect(await ping).toHaveLength(0);
  });

  it("is not a room a client can join itself", async () => {
    const intruder = await connectAs("token-b");
    const refused = new Promise<{ reason: string }>((resolve) =>
      intruder.once("subscribe:error", resolve)
    );
    intruder.emit("subscribe", { channel: "user:user_c" });
    expect((await refused).reason).toBe("invalid_channel");
  });
});

describe("room admission", () => {
  it("keeps a pending or declined recipient out of the live room", async () => {
    mockMembers.set("user_b", "pending");
    mockMembers.set("user_c", "declined");
    for (const token of ["token-b", "token-c"]) {
      const client = await connectAs(token);
      const refused = new Promise<{ reason: string }>((resolve) =>
        client.once("subscribe:error", resolve)
      );
      client.emit("subscribe", { channel: "conversation:conv1" });
      expect((await refused).reason).toBe("forbidden");
    }
  });

  it("evicts a recipient whose request is pending on the next broadcast", async () => {
    const b = await joined("token-b");
    mockMembers.set("user_b", "pending");
    const revoked = new Promise((resolve) => b.once("subscribe:revoked", resolve));
    const silent = collect(b, "message:update", 250);
    await wsServer.broadcastMessage(message);
    await revoked;
    expect(await silent).toHaveLength(0);
  });

  it("refuses a user banned from a realm board's chat", async () => {
    mockConversation.source = "thinktank";
    mockConversation.sourceId = "group1";
    mockBanned = true;
    const client = await connectAs("token-a");
    const refused = new Promise<{ reason: string }>((resolve) =>
      client.once("subscribe:error", resolve)
    );
    client.emit("subscribe", { channel: "conversation:conv1" });
    expect((await refused).reason).toBe("forbidden");
  });
});

describe("typing and read receipts", () => {
  it("relays only the validated fields, with the verified id", async () => {
    const a = await joined("token-a");
    const b = await joined("token-b");
    const heard = collect<Record<string, unknown>>(b, "typing:update", 300);
    a.emit("typing:update", {
      conversationId: "conv1",
      isTyping: true,
      accountId: "spoofed",
      role: "admin",
      html: "<img src=x onerror=alert(1)>",
    });
    const got = await heard;
    expect(got).toHaveLength(1);
    expect(Object.keys(got[0]!).sort()).toEqual([
      "accountId",
      "conversationId",
      "isTyping",
      "timestamp",
    ]);
    expect(got[0]).toMatchObject({ accountId: "user_a", conversationId: "conv1", isTyping: true });
  });

  it("drops malformed typing payloads and rate-limits a burst", async () => {
    const a = await joined("token-a");
    const b = await joined("token-b");
    const heard = collect(b, "typing:update", 400);
    a.emit("typing:update", { conversationId: "conv1", isTyping: "yes" });
    a.emit("typing:update", { conversationId: "conv1", groupId: "g", isTyping: true });
    a.emit("typing:update", { conversationId: { $ne: 1 }, isTyping: true });
    a.emit("typing:update", "nope");
    for (let i = 0; i < 20; i += 1)
      a.emit("typing:update", { conversationId: "conv1", isTyping: true });
    const got = await heard;
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(5);
  });

  it("relays a receipt, but not one from a user whose read receipts are off", async () => {
    const a = await joined("token-a");
    const b = await joined("token-b");
    const on = collect<Record<string, unknown>>(b, "read:receipt", 300);
    a.emit("read:receipt", { conversationId: "conv1", messageId: "m1", extra: 1 });
    const got = await on;
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ accountId: "user_a", messageId: "m1", conversationId: "conv1" });
    expect(got[0]).not.toHaveProperty("extra");

    mockReceiptsOff = new Set(["user_b"]);
    const off = collect(a, "read:receipt", 300);
    b.emit("read:receipt", { conversationId: "conv1", messageId: "m2" });
    expect(await off).toHaveLength(0);
  });

  it("holds a receipt back when the setting cannot be read", async () => {
    mockSettingFails = true;
    const a = await joined("token-a");
    const b = await joined("token-b");
    const heard = collect(b, "read:receipt", 300);
    a.emit("read:receipt", { conversationId: "conv1", messageId: "m1" });
    expect(await heard).toHaveLength(0);
  });
});

describe("the broadcast bridge", () => {
  it("carries recipientIds across processes", () => {
    let listener: ((channel: string, message: string) => void) | undefined;
    const subscriber: BroadcastSubscriber = {
      subscribe: jest.fn(async () => undefined),
      onMessage: (l) => {
        listener = l;
      },
      quit: jest.fn(async () => undefined),
    };
    const server: MessageBroadcaster = {
      broadcastMessage: jest.fn(),
      broadcastBoard: jest.fn(),
      evictFromRoom: jest.fn(),
    };
    startThinkPagesBroadcastSubscriber(server, subscriber);
    listener!(
      THINKPAGES_BROADCAST_CHANNEL,
      JSON.stringify({ ...message, recipientIds: ["user_a"] })
    );
    expect(server.broadcastMessage).toHaveBeenCalledWith(
      expect.objectContaining({ recipientIds: ["user_a"] })
    );
  });
});
