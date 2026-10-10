/**
 * Cross-process delivery for ThinkPages room broadcasts.
 *
 * In production the Socket.IO server runs in ws-backend.mjs, so the Next.js process has no
 * local server. When no local server exists, routers publish each event to Redis; the process
 * hosting Socket.IO subscribes and re-emits it through broadcastMessage, which only targets
 * conversation/group rooms (plan 333). Realm board events (`board:*`, see lib/thinkpages-forum/board-live) travel the
 * same channel and re-emit through broadcastBoard.
 */
import { Redis } from "ioredis";
import { z } from "zod";
import { getEnabledRedisUrl, getSharedRedis } from "~/lib/cache/redis-client";
import { boardLiveEventSchema, type BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-websocket-server";

export const THINKPAGES_BROADCAST_CHANNEL = "ixstats:thinkpages:broadcast";

export interface BoardBroadcaster {
  broadcastBoard(event: BoardLiveEvent): void;
}

export interface MessageBroadcaster extends BoardBroadcaster {
  broadcastMessage(event: ThinkPagesMessageEvent): void;
}

export interface BroadcastPublisher {
  status: string;
  publish(channel: string, message: string): Promise<number>;
}

export interface BroadcastSubscriber {
  subscribe(channel: string): Promise<void>;
  onMessage(listener: (channel: string, message: string) => void): void;
  quit(): Promise<void>;
}

const eventSchema = z.object({
  type: z.enum(["message:new", "message:updated", "message:deleted"]),
  conversationId: z.string().optional(),
  groupId: z.string().optional(),
  messageId: z.string(),
  accountId: z.string(),
  content: z.string().optional(),
  timestamp: z.number(),
});

/** Everything the channel carries: room messages and realm board events. */
const busSchema = z.union([eventSchema, boardLiveEventSchema]);
type BusEvent = z.infer<typeof busSchema>;

const isBoardEvent = (event: BusEvent): event is BoardLiveEvent => event.type.startsWith("board:");

let warnedUnavailable = false;

/** Publishes a room event for the Socket.IO process. Room-less events are never delivered. */
export function publishThinkPagesEvent(
  event: ThinkPagesMessageEvent,
  publisher: BroadcastPublisher | null = getSharedRedis()
): void {
  if (!event.conversationId && !event.groupId) return;
  publishToSocketServer(event, publisher);
}

/** Publishes a realm board event for the Socket.IO process, which emits it to the realm's room. */
export function publishBoardEvent(
  event: BoardLiveEvent,
  publisher: BroadcastPublisher | null = getSharedRedis()
): void {
  publishToSocketServer(event, publisher);
}

function publishToSocketServer(
  event: ThinkPagesMessageEvent | BoardLiveEvent,
  publisher: BroadcastPublisher | null
): void {
  if (publisher?.status !== "ready") {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn("[ThinkPagesBridge] Redis unavailable; realtime broadcasts are dropped");
    }
    return;
  }
  publisher.publish(THINKPAGES_BROADCAST_CHANNEL, JSON.stringify(event)).catch((err: Error) => {
    console.warn("[ThinkPagesBridge] Publish failed:", err.message);
  });
}

export const redisThinkPagesBroadcaster: MessageBroadcaster = {
  broadcastMessage: (event) => publishThinkPagesEvent(event),
  broadcastBoard: (event) => publishBoardEvent(event),
};

function parseEvent(raw: string): BusEvent | null {
  try {
    const parsed = busSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A dedicated Redis subscriber connection, or null when Redis is disabled. Shared by the bridges. */
export function createBroadcastSubscriber(
  logPrefix = "[ThinkPagesBridge]"
): BroadcastSubscriber | null {
  const url = getEnabledRedisUrl();
  if (!url) return null;
  // Subscriber mode needs its own connection; SUBSCRIBE waits for the first connect.
  const client = new Redis(url, { maxRetriesPerRequest: null });
  let lastError = "";
  client.on("error", (err: Error) => {
    if (err.message === lastError) return;
    lastError = err.message;
    console.warn(`${logPrefix} Redis subscriber error:`, err.message);
  });
  return {
    subscribe: async (channel) => {
      await client.subscribe(channel);
    },
    onMessage: (listener) => {
      client.on("message", listener);
    },
    quit: async () => {
      await client.quit();
    },
  };
}

/** Re-emits published events on the local Socket.IO server. Returns null when Redis is disabled. */
export function startThinkPagesBroadcastSubscriber(
  server: MessageBroadcaster,
  subscriber: BroadcastSubscriber | null = createBroadcastSubscriber()
): BroadcastSubscriber | null {
  if (!subscriber) {
    console.warn("[ThinkPagesBridge] Redis disabled; cross-process broadcasts are off");
    return null;
  }
  subscriber.onMessage((channel, raw) => {
    if (channel !== THINKPAGES_BROADCAST_CHANNEL) return;
    const event = parseEvent(raw);
    if (!event) return;
    if (isBoardEvent(event)) server.broadcastBoard(event);
    else server.broadcastMessage(event);
  });
  subscriber.subscribe(THINKPAGES_BROADCAST_CHANNEL).catch((err: Error) => {
    console.error("[ThinkPagesBridge] Subscribe failed:", err.message);
  });
  return subscriber;
}
