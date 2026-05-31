"use client";

import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

export interface VaultStats {
  totalCards: number;
  deckValue: number;
  unopenedPacks: number;
  activeAuctions: number;
  capacityBoost: number;
}

/**
 * Hook to fetch vault dashboard statistics.
 * Automatically refreshes card values from NS API if deck value is 0 but user has cards.
 */
export function useVaultStats() {
  const { userId } = useAuth();
  const hasTriedRefresh = useRef(false);

  const {
    data: userData,
    isLoading: userLoading,
    refetch: refetchStats,
  } = api.vault.getUserStats.useQuery(undefined, { enabled: !!userId });

  const { data: myPacksData } = api.cardPacks.getMyPacks.useQuery(
    { isOpened: false },
    { enabled: !!userId }
  );

  const { data: myAuctionsData } = api.cardMarket.getMyActiveAuctions.useQuery(undefined, {
    enabled: !!userId,
  });

  const refreshMutation = api.nsImport.refreshCardValues.useMutation({
    onSuccess: () => {
      void refetchStats();
    },
  });

  // Auto-refresh if user has cards but 0 deck value (stale data)
  useEffect(() => {
    if (
      !hasTriedRefresh.current &&
      userData &&
      userData.totalCards > 0 &&
      userData.deckValue === 0 &&
      !refreshMutation.isPending
    ) {
      hasTriedRefresh.current = true;
      refreshMutation.mutate();
    }
  }, [userData, refreshMutation]);

  const stats: VaultStats = {
    totalCards: userData?.totalCards ?? 0,
    deckValue: userData?.deckValue ?? 0,
    unopenedPacks: myPacksData?.packs?.length ?? 0,
    activeAuctions: myAuctionsData?.auctions?.length ?? 0,
    capacityBoost: userData?.capacityBoost ?? 0,
  };

  return {
    stats,
    loading: userLoading,
    refreshing: refreshMutation.isPending,
    refetch: refetchStats,
    refreshCardValues: () => refreshMutation.mutate(),
  };
}
