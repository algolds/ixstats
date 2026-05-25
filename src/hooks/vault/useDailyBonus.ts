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
import { useNotify } from "~/hooks/useNotify";

export function useDailyBonus() {
  const notify = useNotify();
  const utils = api.useUtils();

  const claimMutation = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      notify.success(
        `Daily bonus claimed! +${data.bonus} IxCredits`,
        `Login streak: ${data.streak} ${data.streak === 1 ? "day" : "days"}`
      );
    },
    onError: (error) => {
      notify.error(error.message || "Failed to claim daily bonus");
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
