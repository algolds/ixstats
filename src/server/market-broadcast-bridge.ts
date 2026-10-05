/**
 * Cross-process delivery for IxCards market broadcasts (PL-4).
 *
 * Auctions change in the web process (bids, buyouts) and in the cron process (completions), but
 * browsers hold their market socket on whichever process nginx routes /api/market-ws to
 * (ws-backend.mjs in production). So every broadcast is published to Redis, and every process
 * that hosts a market socket subscribes and re-emits it. Without Redis the event goes to the
 * local socket, if this process has one, as before.
 */
import { z } from "zod";
import { getSharedRedis } from "~/lib/cache/redis-client";
import {
  createBroadcastSubscriber,
  type BroadcastPublisher,
  type BroadcastSubscriber,
} from "~/server/thinkpages-broadcast-bridge";

export const MARKET_BROADCAST_CHANNEL = "ixstats:market:broadcast";

const messageSchema = z.object({
  type: z.enum(["bid", "auction_complete", "price_update", "auction_created"]),
  data: z.unknown(),
});

export type MarketBroadcastMessage = z.infer<typeof messageSchema>;

export interface MarketBroadcastTarget {
  broadcast(message: MarketBroadcastMessage): void;
}

/** Sends a market event to every connected client, whichever process holds their socket. */
export function publishMarketEvent(
  message: MarketBroadcastMessage,
  local: MarketBroadcastTarget | null,
  publisher: BroadcastPublisher | null = getSharedRedis()
): void {
  if (publisher?.status !== "ready") {
    local?.broadcast(message);
    return;
  }
  // This process's own subscriber re-emits it locally, so don't broadcast twice.
  publisher.publish(MARKET_BROADCAST_CHANNEL, JSON.stringify(message)).catch((err: Error) => {
    console.warn("[MarketBridge] Publish failed; delivering locally only:", err.message);
    local?.broadcast(message);
  });
}

function parseMessage(raw: string): MarketBroadcastMessage | null {
  try {
    const parsed = messageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Re-emits published market events on this process's socket. Returns null when Redis is disabled. */
export function startMarketBroadcastSubscriber(
  server: MarketBroadcastTarget,
  subscriber: BroadcastSubscriber | null = createBroadcastSubscriber("[MarketBridge]")
): BroadcastSubscriber | null {
  if (!subscriber) return null;
  subscriber.onMessage((channel, raw) => {
    if (channel !== MARKET_BROADCAST_CHANNEL) return;
    const message = parseMessage(raw);
    if (message) server.broadcast(message);
  });
  subscriber.subscribe(MARKET_BROADCAST_CHANNEL).catch((err: Error) => {
    console.error("[MarketBridge] Subscribe failed:", err.message);
  });
  return subscriber;
}
