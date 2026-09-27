/** @jest-environment node */
import { createServer, type Server as HTTPServer } from "http";
import type { AddressInfo } from "net";
import { io as connectClient, type Socket as ClientSocket } from "socket.io-client";
import { ThinkPagesWebSocketServer } from "~/lib/websocket/thinkpages-websocket-server";

const mockTokens: Record<string, string> = { "token-a": "user_a", "token-b": "user_b" };

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
    auth: token ? { token } : {},
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

describe("ThinkPagesWebSocketServer handshake", () => {
  it("rejects a connection without a token", async () => {
    const error = await nextEvent<Error>(connect(), "connect_error");
    expect(error.message).toBe("unauthorized");
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
