// src/hooks/marketplace/useAuctionBid.ts
// Hook for placing bids on auctions with optimistic updates

import { useState, useCallback } from "react";
import type { PlaceBidInput, Bid } from "~/types/marketplace";

interface UseAuctionBidReturn {
  placeBid: (input: PlaceBidInput) => Promise<void>;
  isPlacing: boolean;
  error: Error | null;
  lastBid: Bid | null;
}

/**
 * Hook for placing bids on auctions
 * Implements optimistic updates with rollback on error
 */
export function useAuctionBid(): UseAuctionBidReturn {
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastBid, setLastBid] = useState<Bid | null>(null);

  /**
   * Place a bid on an auction
   * @param input - Bid placement input
   */
  const placeBid = useCallback(async (input: PlaceBidInput) => {
    setIsPlacing(true);
    setError(null);

    // Store previous state for rollback
    const previousBid = lastBid;

    try {
      // Optimistic update - create temporary bid
      const optimisticBid: Bid = {
        id: `temp-${Date.now()}`,
        auctionId: input.auctionId,
        bidderId: "current-user", // TODO: Get from auth context
        bidderName: "You",
        amount: input.amount,
        timestamp: Date.now(), // IxTime will be set by server
        isAutoBid: false,
      };

      setLastBid(optimisticBid);

      // TODO: Replace with actual tRPC mutation when Agent 6 implements
      // const result = await api.auctions.placeBid.mutate(input);
      // setLastBid(result);

      // Mock success for now
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("[useAuctionBid] Bid placed successfully:", input);
    } catch (err) {
      console.error("[useAuctionBid] Error placing bid:", err);

      // Rollback optimistic update
      setLastBid(previousBid);

      setError(
        err instanceof Error ? err : new Error("Failed to place bid")
      );

      throw err;
    } finally {
      setIsPlacing(false);
    }
  }, [lastBid]);

  return {
    placeBid,
    isPlacing,
    error,
    lastBid,
  };
}
