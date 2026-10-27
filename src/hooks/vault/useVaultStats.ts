"use client";

import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

interface VaultStats {
  totalCards: number;
  deckValue: number;
}

/** The wallet's card figures: copies held and their value (cards refresh §3: computed live, one copy value). */
export function useVaultStats() {
  const { userId } = useAuth();
  const { data, isLoading, isError, refetch } = api.vault.getUserStats.useQuery(undefined, {
    enabled: !!userId,
  });
  const stats: VaultStats = { totalCards: data?.totalCards ?? 0, deckValue: data?.deckValue ?? 0 };
  return { stats, loading: isLoading, error: isError, refetch };
}
