"use client";
// src/hooks/marketplace/useAuctionBid.ts
// Hook for placing bids and buyouts on auctions via tRPC

import { api } from "~/trpc/react";
import { useBidRefresh, useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface UseAuctionBidReturn {
  placeBid: (auctionId: string, amount: number) => void;
  executeBuyout: (auctionId: string) => void;
  isBidding: boolean;
  isBuyingOut: boolean;
  error: string | null;
}

/**
 * Hook for placing bids and executing buyouts on auctions. A bid holds its credits, so it reads the Market and the
 * balance again; a buyout moves the copy, so it reads every card screen again.
 */
export function useAuctionBid(options?: { onSuccess?: () => void }): UseAuctionBidReturn {
  const refreshCards = useCardsRefresh();
  const refreshBid = useBidRefresh();

  const bidMutation = api.cardMarket.placeBid.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data.message);
      refreshBid();
      options?.onSuccess?.();
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  const buyoutMutation = api.cardMarket.executeBuyout.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data.message);
      if (data.leveledUp && data.newLevel != null) {
        vaultNotify.success(`Card leveled up to Level ${data.newLevel}!`, "Level Up!");
      }
      refreshCards();
      options?.onSuccess?.();
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  return {
    placeBid: (auctionId: string, amount: number) => bidMutation.mutate({ auctionId, amount }),
    executeBuyout: (auctionId: string) => buyoutMutation.mutate({ auctionId }),
    isBidding: bidMutation.isPending,
    isBuyingOut: buyoutMutation.isPending,
    error: bidMutation.error?.message ?? buyoutMutation.error?.message ?? null,
  };
}
