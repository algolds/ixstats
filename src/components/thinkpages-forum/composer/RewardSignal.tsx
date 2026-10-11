"use client";

import { useCallback, useState } from "react";
import { Signal } from "~/components/ui/signal";
import { rewardLine, type ForumReward } from "~/lib/action-rewards";

/**
 * What the last post earned, for a composer to show until the next edit. `show(null)` and `clear()` both mean none.
 * Kept apart from the composers so each stays small.
 */
export function useRewardLine() {
  const [reward, setReward] = useState<ForumReward | null>(null);
  const show = useCallback(
    (earned: ForumReward | null | undefined) => setReward(earned ?? null),
    []
  );
  const clear = useCallback(() => setReward(null), []);
  return { reward, show, clear };
}

/** The success line under a composer: "+5 IxC for posting your action". Nothing when the post earned nothing. */
export function RewardSignal({ reward }: { reward: ForumReward | null }) {
  return reward ? <Signal tone="success" title={rewardLine(reward.amount)} /> : null;
}
