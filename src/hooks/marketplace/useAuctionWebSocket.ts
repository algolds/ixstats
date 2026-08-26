// src/hooks/marketplace/useAuctionWebSocket.ts
// React hook for real-time auction updates via WebSocket

"use client";

import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { getMarketWebSocketClient } from "~/lib/websocket/market-websocket-client";

/**
 * React hook that subscribes to real-time marketplace WebSocket events
 * and invalidates tRPC queries so the UI stays in sync.
 *
 * Connect on mount when `enabled` is true, disconnect on unmount.
 */
export function useAuctionWebSocket({ enabled = true }: { enabled?: boolean } = {}) {
  const utils = api.useUtils();
  const clientRef = useRef<ReturnType<typeof getMarketWebSocketClient> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const client = getMarketWebSocketClient();
    clientRef.current = client;
    client.connect();

    // Subscribe to all bid events (no filter)
    const bidId = `hook-bid-${Math.random()}`;
    (client as any).subscriptions.set(bidId, {
      id: bidId,
      type: "bid",
      callback: () => {
        utils.cardMarket.getActiveAuctions.invalidate();
        utils.cardMarket.getMyActiveBids.invalidate();
        utils.cardMarket.getEndingSoon.invalidate();
      },
    });

    // Subscribe to all auction complete events
    const completeId = `hook-complete-${Math.random()}`;
    (client as any).subscriptions.set(completeId, {
      id: completeId,
      type: "auction_complete",
      callback: () => {
        utils.cardMarket.getActiveAuctions.invalidate();
        utils.cardMarket.getMyActiveAuctions.invalidate();
        utils.cardMarket.getMyAuctionParticipation.invalidate();
        utils.cardMarket.getEndingSoon.invalidate();
        utils.vault.getBalance.invalidate();
      },
    });

    // Subscribe to all new auction events
    const newId = `hook-new-${Math.random()}`;
    (client as any).subscriptions.set(newId, {
      id: newId,
      type: "auction_created",
      callback: () => {
        utils.cardMarket.getActiveAuctions.invalidate();
        utils.cardMarket.getMyActiveAuctions.invalidate();
      },
    });

    return () => {
      (client as any).subscriptions.delete(bidId);
      (client as any).subscriptions.delete(completeId);
      (client as any).subscriptions.delete(newId);
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [enabled, utils]);
}
