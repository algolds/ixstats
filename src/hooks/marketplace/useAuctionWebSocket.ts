"use client";
// src/hooks/marketplace/useAuctionWebSocket.ts
// React hook for real-time auction updates via WebSocket

import { useEffect } from "react";
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

  useEffect(() => {
    if (!enabled) return;

    const client = getMarketWebSocketClient();
    client.connect();

    const unsubscribes = [
      client.subscribeToAll("bid", () => {
        void utils.cardMarket.getActiveAuctions.invalidate();
        void utils.cardMarket.getMyActiveBids.invalidate();
      }),
      client.subscribeToAll("auction_complete", () => {
        void utils.cardMarket.getActiveAuctions.invalidate();
        void utils.cardMarket.getMyActiveAuctions.invalidate();
        void utils.cardMarket.getMyAuctionParticipation.invalidate();
        void utils.vault.getBalance.invalidate();
      }),
      client.subscribeToAll("auction_created", () => {
        void utils.cardMarket.getActiveAuctions.invalidate();
        void utils.cardMarket.getMyActiveAuctions.invalidate();
      }),
    ];

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      client.disconnect();
    };
  }, [enabled, utils]);
}
