"use client";

import { api } from "~/trpc/react";

export interface RecentActivity {
  id: string;
  type: string;
  amount: number;
  source: string;
  createdAt: Date;
}

/**
 * Hook to fetch recent vault transactions
 * Returns the last 10 transactions for display on dashboard
 */
export function useRecentActivity() {
  const { data, isLoading, refetch } = api.vault.getTransactions.useQuery({
    limit: 10,
    offset: 0,
  });

  const activities: RecentActivity[] = data?.transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    source: tx.source,
    createdAt: tx.createdAt,
  })) ?? [];

  return {
    activities,
    loading: isLoading,
    refetch,
  };
}
