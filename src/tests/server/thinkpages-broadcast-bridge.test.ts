/** @jest-environment node */
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-websocket-server";
import {
  THINKPAGES_BROADCAST_CHANNEL,
  publishBoardEvent,
  publishThinkPagesEvent,
  redisThinkPagesBroadcaster,
  startThinkPagesBroadcastSubscriber,
  type BroadcastPublisher,
  type BroadcastSubscriber,
  type MessageBroadcaster,
} from "~/server/thinkpages-broadcast-bridge";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";

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
  it("delivers a published event to the subscribed Socket.IO server", () => {
    const redis = createFakeRedis();
    const server = fakeServer();
    startThinkPagesBroadcastSubscriber(server, redis.subscriber);

    publishThinkPagesEvent(event, redis.publisher);

    expect(redis.subscriber.subscribe).toHaveBeenCalledWith(THINKPAGES_BROADCAST_CHANNEL);
    expect(redis.publisher.publish).toHaveBeenCalledWith(
      THINKPAGES_BROADCAST_CHANNEL,
      JSON.stringify(event)
    );
    expect(server.broadcastMessage).toHaveBeenCalledWith(event);
  });

  it("delivers thinktank group events", () => {
    const redis = createFakeRedis();
    const server = fakeServer();
    startThinkPagesBroadcastSubscriber(server, redis.subscriber);
    const groupEvent: ThinkPagesMessageEvent = {
      ...event,
      conversationId: undefined,
      groupId: "g1",
    };

    publishThinkPagesEvent(groupEvent, redis.publisher);

    expect(server.broadcastMessage).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "g1", messageId: "msg1" })
    );
  });

  it("does not publish events without a conversation or group room", () => {
    const redis = createFakeRedis();
    publishThinkPagesEvent({ ...event, conversationId: undefined }, redis.publisher);
    expect(redis.publisher.publish).not.toHaveBeenCalled();
  });

  it("drops without publishing while Redis is not ready", () => {
    const redis = createFakeRedis("connecting");
    publishThinkPagesEvent(event, redis.publisher);
    expect(redis.publisher.publish).not.toHaveBeenCalled();
  });

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

    it("carries every board event kind through the schema", () => {
      const redis = createFakeRedis();
      const server = fakeServer();
      startThinkPagesBroadcastSubscriber(server, redis.subscriber);
      const kinds: BoardLiveEvent[] = [
        {
          type: "board:settings",
          realmId: "r1",
          settings: { visitorsAllowed: true, slowModeSeconds: 10 },
        },
        { type: "board:typing", realmId: "r1", name: "Ada" },
        { type: "board:presence", realmId: "r1", count: 4 },
      ];
      for (const kind of kinds) publishBoardEvent(kind, redis.publisher);
      expect(server.broadcastBoard.mock.calls.map(([e]) => e)).toEqual(kinds);
    });

    it("drops a malformed board event and a board event while Redis is not ready", () => {
      const redis = createFakeRedis();
      const server = fakeServer();
      startThinkPagesBroadcastSubscriber(server, redis.subscriber);
      redis.deliver(
        THINKPAGES_BROADCAST_CHANNEL,
        JSON.stringify({ type: "board:presence", realmId: "r1" })
      );
      expect(server.broadcastBoard).not.toHaveBeenCalled();

      const down = createFakeRedis("connecting");
      publishBoardEvent(boardEvent, down.publisher);
      expect(down.publisher.publish).not.toHaveBeenCalled();
    });

    it("routes through Redis from the web process", () => {
      expect(redisThinkPagesBroadcaster.broadcastBoard).toEqual(expect.any(Function));
    });
  });

  it("returns null and does not subscribe when Redis is disabled", () => {
    expect(startThinkPagesBroadcastSubscriber(fakeServer(), null)).toBeNull();
  });

  it("logs once and drops every broadcast when Redis is disabled", async () => {
    jest.resetModules();
    const fresh = await import("~/server/thinkpages-broadcast-bridge");

    fresh.publishThinkPagesEvent(event, null);
    fresh.publishThinkPagesEvent(event, null);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("routes through Redis when this process hosts no Socket.IO server", () => {
    expect(getThinkPagesBroadcaster()).toBe(redisThinkPagesBroadcaster);
  });
});
