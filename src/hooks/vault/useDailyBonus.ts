/**
 * useDailyBonus Hook
 *
 * Daily bonus claim with streak tracking
 * - 24-hour cooldown enforcement
 * - Login streak tracking
 * - Toast notifications for claim status
 */

"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";

export function useDailyBonus() {
  const utils = api.useUtils();

  const claimMutation = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      toast.success(`Daily bonus claimed! +${data.bonus} IxCredits`, {
        description: `Login streak: ${data.streak} ${data.streak === 1 ? "day" : "days"}`,
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to claim daily bonus");
    },
    onSettled: () => {
      // Invalidate balance and earnings summary
      void utils.vault.getBalance.invalidate();
      void utils.vault.getEarningsSummary.invalidate();
    },
  });

  const claim = () => {
    claimMutation.mutate();
  };

  return {
    claim,
    isClaiming: claimMutation.isPending,
    error: claimMutation.error,
  };
}
