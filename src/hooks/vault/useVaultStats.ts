"use client";

import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

export interface VaultStats {
  totalCards: number;
  deckValue: number;
  unopenedPacks: number;
  activeAuctions: number;
}

/**
 * Hook to fetch vault dashboard statistics
 * Returns aggregated stats about user's card collection and activities
 */
export function useVaultStats() {
  const { userId } = useAuth();

  // Fetch user's card statistics
  const { data: userData, isLoading: userLoading } = api.vault.getUserStats.useQuery(
    undefined,
    { enabled: !!userId }
  );

  const stats: VaultStats = {
    totalCards: userData?.totalCards ?? 0,
    deckValue: userData?.deckValue ?? 0,
    unopenedPacks: 0, // TODO: Implement pack tracking
    activeAuctions: 0, // TODO: Implement auction tracking
  };

  return {
    stats,
    loading: userLoading,
    refetch: () => Promise.resolve(),
  };
}
