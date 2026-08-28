"use client";
// src/hooks/marketplace/useAuctionBid.ts
// Hook for placing bids and buyouts on auctions via tRPC

import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";

interface UseAuctionBidReturn {
  placeBid: (auctionId: string, amount: number) => void;
  executeBuyout: (auctionId: string) => void;
  isBidding: boolean;
  isBuyingOut: boolean;
  error: string | null;
}

/**
 * Hook for placing bids and executing buyouts on auctions
 */
export function useAuctionBid(options?: { onSuccess?: () => void }): UseAuctionBidReturn {
  const utils = api.useUtils();

  const bidMutation = api.cardMarket.placeBid.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data.message);
      void utils.cardMarket.getActiveAuctions.invalidate();
      void utils.cardMarket.getMyActiveBids.invalidate();
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
      void utils.cardMarket.getActiveAuctions.invalidate();
      void utils.cardMarket.getMyActiveBids.invalidate();
      void utils.vault.getBalance.invalidate();
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
