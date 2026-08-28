"use client";
/**
 * useVaultBalance Hook
 *
 * Real-time balance fetching with auto-refresh
 * - Polls every 60 seconds (visibility-aware)
 * - Refetches on window focus
 * - Provides manual refresh function
 */

import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";

export function useVaultBalance() {
  const { userId } = useAuth();
  const refetchInterval = useVisibleRefetch(60000);

  const {
    data: balanceData,
    isLoading,
    refetch,
  } = api.vault.getBalance.useQuery(
    { userId: userId ?? "" },
    {
      enabled: !!userId,
      refetchInterval,
      refetchOnWindowFocus: true,
      staleTime: 30000,
    }
  );

  return {
    balance: balanceData?.credits ?? 0,
    lifetimeEarned: balanceData?.lifetimeEarned ?? 0,
    lifetimeSpent: balanceData?.lifetimeSpent ?? 0,
    todayEarned: balanceData?.todayEarned ?? 0,
    vaultLevel: balanceData?.vaultLevel ?? 1,
    vaultXp: balanceData?.vaultXp ?? 0,
    loginStreak: balanceData?.loginStreak ?? 0,
    premiumMultiplier: balanceData?.premiumMultiplier ?? 1.0,
    isPremium: balanceData?.isPremium ?? false,
    isLoading,
    refresh: refetch,
  };
}
