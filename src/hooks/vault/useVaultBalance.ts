/**
 * useVaultBalance Hook
 *
 * Real-time balance fetching with auto-refresh
 * - Polls every 30 seconds for updates
 * - Refetches on window focus
 * - Provides manual refresh function
 */

"use client";

import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

export function useVaultBalance() {
  const { userId } = useAuth();

  const { data: balanceData, isLoading, refetch } = api.vault.getBalance.useQuery(
    { userId: userId ?? "" },
    {
      enabled: !!userId,
      refetchInterval: 30000, // Auto-refresh every 30 seconds
      refetchOnWindowFocus: true,
      staleTime: 25000, // Consider data stale after 25 seconds
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
