// src/hooks/marketplace/useLiveAuction.ts
// Hook for subscribing to live auction updates via WebSocket

import { useState, useEffect, useCallback, useRef } from "react";
import { getMarketWebSocketClient } from "~/lib/market-websocket-client";
import type { AuctionListing, Bid } from "~/types/marketplace";

interface UseLiveAuctionOptions {
  auctionId: string;
  initialAuction?: AuctionListing;
  autoConnect?: boolean;
}

interface UseLiveAuctionReturn {
  auction: AuctionListing | null;
  isLive: boolean;
  lastBid: Bid | null;
  isCompleted: boolean;
  connectionState: {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
  };
  refetch: () => Promise<void>;
}

/**
 * Hook for subscribing to live auction updates
 * Manages WebSocket connection and state synchronization
 */
export function useLiveAuction(
  options: UseLiveAuctionOptions
): UseLiveAuctionReturn {
  const { auctionId, initialAuction, autoConnect = true } = options;

  const [auction, setAuction] = useState<AuctionListing | null>(
    initialAuction || null
  );
  const [lastBid, setLastBid] = useState<Bid | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [connectionState, setConnectionState] = useState({
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
  });

  const wsClient = useRef(getMarketWebSocketClient());
  const unsubscribeBidRef = useRef<(() => void) | null>(null);
  const unsubscribeCompleteRef = useRef<(() => void) | null>(null);

  /**
   * Handle new bid update
   */
  const handleBidUpdate = useCallback((bid: Bid) => {
    console.log("[useLiveAuction] New bid received:", bid);

    setLastBid(bid);

    // Update auction state
    setAuction((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        currentBid: bid.amount,
        bidCount: prev.bidCount + 1,
        // Extend auction time by 1 minute if bid placed in last minute
        endTime: prev.endTime, // TODO: Server should handle time extension
      };
    });
  }, []);

  /**
   * Handle auction completion
   */
  const handleAuctionComplete = useCallback(
    (data: { auctionId: string; winnerId: string; finalPrice: number }) => {
      console.log("[useLiveAuction] Auction completed:", data);

      setIsCompleted(true);

      setAuction((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          isExpired: true,
          currentBid: data.finalPrice,
        };
      });
    },
    []
  );

  /**
   * Refetch auction data from API
   */
  const refetch = useCallback(async () => {
    try {
      // TODO: Replace with actual tRPC query when Agent 6 implements
      // const updated = await api.auctions.getAuction.query({ auctionId });
      // setAuction(updated);

      console.log("[useLiveAuction] Refetching auction:", auctionId);
    } catch (error) {
      console.error("[useLiveAuction] Error refetching auction:", error);
    }
  }, [auctionId]);

  /**
   * Update connection state periodically
   */
  useEffect(() => {
    const updateConnectionState = () => {
      const state = wsClient.current.getState();
      setConnectionState(state);
    };

    updateConnectionState();
    const interval = setInterval(updateConnectionState, 2000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Setup WebSocket subscriptions
   */
  useEffect(() => {
    if (!autoConnect || !auctionId) return;

    // Connect if not already connected
    if (!wsClient.current.isConnected()) {
      wsClient.current.connect();
    }

    // Subscribe to bid updates
    unsubscribeBidRef.current = wsClient.current.subscribeToBid(
      auctionId,
      handleBidUpdate
    );

    // Subscribe to auction completion
    unsubscribeCompleteRef.current =
      wsClient.current.subscribeToAuctionComplete(
        auctionId,
        handleAuctionComplete
      );

    console.log(`[useLiveAuction] Subscribed to auction ${auctionId}`);

    // Cleanup subscriptions on unmount
    return () => {
      if (unsubscribeBidRef.current) {
        unsubscribeBidRef.current();
        unsubscribeBidRef.current = null;
      }

      if (unsubscribeCompleteRef.current) {
        unsubscribeCompleteRef.current();
        unsubscribeCompleteRef.current = null;
      }

      console.log(`[useLiveAuction] Unsubscribed from auction ${auctionId}`);
    };
  }, [auctionId, autoConnect, handleBidUpdate, handleAuctionComplete]);

  return {
    auction,
    isLive: connectionState.connected && !isCompleted,
    lastBid,
    isCompleted,
    connectionState,
    refetch,
  };
}
