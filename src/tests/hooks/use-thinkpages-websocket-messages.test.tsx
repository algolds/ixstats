import { act, renderHook } from "@testing-library/react";

type Handler = (data?: object) => void;
const fake = {
  handlers: new Map<string, Handler[]>(),
  connected: false,
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  active: true,
  on(name: string, handler: Handler) {
    fake.handlers.set(name, [...(fake.handlers.get(name) ?? []), handler]);
    return fake;
  },
};
jest.mock("socket.io-client", () => ({ io: () => fake }));
jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ getToken: async () => "token", isSignedIn: true }),
}));

import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-types";

const env = process.env as Record<string, string | undefined>;
const saved = env.NEXT_PUBLIC_ENABLE_WEBSOCKET;
const fire = (name: string, data?: object) =>
  act(() => {
    for (const handler of fake.handlers.get(name) ?? []) handler(data);
  });
const subscribes = () =>
  fake.emit.mock.calls.filter(([name]) => name === "subscribe").map(([, p]) => p.channel);

beforeEach(() => {
  env.NEXT_PUBLIC_ENABLE_WEBSOCKET = "true";
  fake.handlers.clear();
  fake.connected = false;
  fake.emit.mockReset();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  env.NEXT_PUBLIC_ENABLE_WEBSOCKET = saved;
  jest.restoreAllMocks();
});

describe("useThinkPagesWebSocket conversation subscriptions", () => {
  it("queues a subscription made before connecting and joins on connect", () => {
    const { result } = renderHook(() => useThinkPagesWebSocket({ accountId: "u1" }));
    act(() => result.current.subscribeToConversation("c1"));
    expect(subscribes()).toEqual([]);
    fake.connected = true;
    fire("connect");
    expect(subscribes()).toEqual(["conversation:c1"]);
  });

  it("replays every current subscription on each reconnect", () => {
    const { result } = renderHook(() => useThinkPagesWebSocket({ accountId: "u1" }));
    fake.connected = true;
    fire("connect");
    act(() => result.current.subscribeToConversation("c1"));
    act(() => result.current.subscribeToGroup("g1"));
    fake.emit.mockClear();
    fire("disconnect");
    fake.connected = true;
    fire("connect");
    expect(subscribes().sort()).toEqual(["conversation:c1", "group:g1"]);
  });

  it("stops replaying a conversation once it is left, even while offline", () => {
    const { result } = renderHook(() => useThinkPagesWebSocket({ accountId: "u1" }));
    fake.connected = true;
    fire("connect");
    act(() => result.current.subscribeToConversation("c1"));
    act(() => result.current.subscribeToConversation("c2"));
    fake.connected = false;
    fire("disconnect");
    act(() => result.current.unsubscribeFromConversation("c1"));
    fake.emit.mockClear();
    fake.connected = true;
    fire("connect");
    expect(subscribes()).toEqual(["conversation:c2"]);
  });

  it("emits unsubscribe for the previous thread when connected", () => {
    const { result } = renderHook(() => useThinkPagesWebSocket({ accountId: "u1" }));
    fake.connected = true;
    fire("connect");
    act(() => result.current.subscribeToConversation("c1"));
    act(() => result.current.unsubscribeFromConversation("c1"));
    expect(fake.emit).toHaveBeenCalledWith("unsubscribe", { channel: "conversation:c1" });
  });
});

describe("useThinkPagesWebSocket message events", () => {
  const event: ThinkPagesMessageEvent = {
    type: "message:new",
    conversationId: "c1",
    messageId: "m1",
    accountId: "u2",
    content: "hi",
    timestamp: 1,
  };

  it("hands onMessageUpdate the event itself, not the server's envelope", () => {
    const onMessageUpdate = jest.fn();
    renderHook(() => useThinkPagesWebSocket({ accountId: "u1", onMessageUpdate }));
    fire("message:update", {
      type: "message:update",
      data: event,
      timestamp: 2,
      channel: "conversation:c1",
    });
    expect(onMessageUpdate).toHaveBeenCalledWith(event);
    expect(onMessageUpdate.mock.calls[0]![0].type).toBe("message:new");
  });

  it("ignores an envelope without a message event", () => {
    const onMessageUpdate = jest.fn();
    renderHook(() => useThinkPagesWebSocket({ accountId: "u1", onMessageUpdate }));
    fire("message:update", { type: "message:update", timestamp: 2 });
    fire("message:update", { type: "message:update", data: { type: "other", messageId: "m" } });
    expect(onMessageUpdate).not.toHaveBeenCalled();
  });

  it("passes inbox updates to onInboxUpdate", () => {
    const onInboxUpdate = jest.fn();
    renderHook(() => useThinkPagesWebSocket({ accountId: "u1", onInboxUpdate }));
    const update = { type: "inbox:update", conversationId: "c9", timestamp: 3 };
    fire("inbox:update", update);
    expect(onInboxUpdate).toHaveBeenCalledWith(update);
  });
});
