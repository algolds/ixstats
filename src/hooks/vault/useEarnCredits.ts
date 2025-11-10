/**
 * useEarnCredits Hook
 *
 * Generic earning mutation with optimistic updates
 * - Optimistic UI updates with rollback on error
 * - Toast notifications for success/error
 * - Automatic balance invalidation on success
 */

"use client";

import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { type VaultTransactionType } from "@prisma/client";

interface EarnCreditsOptions {
  amount: number;
  type: VaultTransactionType;
  source: string;
  metadata?: Record<string, any>;
  onSuccess?: (newBalance: number) => void;
  onError?: (error: Error) => void;
}

export function useEarnCredits() {
  const { userId } = useAuth();
  const utils = api.useUtils();

  const earnMutation = api.vault.earnCredits.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.vault.getBalance.cancel();

      // Snapshot previous value
      const previousBalance = utils.vault.getBalance.getData({ userId: userId ?? "" });

      // Optimistically update balance
      if (previousBalance) {
        utils.vault.getBalance.setData(
          { userId: userId ?? "" },
          {
            ...previousBalance,
            credits: previousBalance.credits + variables.amount,
            todayEarned: previousBalance.todayEarned + variables.amount,
            lifetimeEarned: previousBalance.lifetimeEarned + variables.amount,
          }
        );
      }

      return { previousBalance };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousBalance) {
        utils.vault.getBalance.setData(
          { userId: userId ?? "" },
          context.previousBalance
        );
      }
      toast.error(err.message || "Failed to earn credits");
    },
    onSuccess: (data, variables) => {
      toast.success(`Earned ${variables.amount} IxCredits!`, {
        description: data.message,
      });
    },
    onSettled: () => {
      // Always refetch after mutation settles
      void utils.vault.getBalance.invalidate();
      void utils.vault.getEarningsSummary.invalidate();
    },
  });

  const earn = (options: EarnCreditsOptions) => {
    if (!userId) {
      toast.error("You must be logged in to earn credits");
      return;
    }

    earnMutation.mutate(
      {
        amount: options.amount,
        type: options.type,
        source: options.source,
        metadata: options.metadata,
      },
      {
        onSuccess: (data) => options.onSuccess?.(data.newBalance),
        onError: (error) => options.onError?.(error as Error),
      }
    );
  };

  return {
    earn,
    isEarning: earnMutation.isPending,
    error: earnMutation.error,
  };
}
