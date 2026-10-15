"use client";

import { useSyncExternalStore } from "react";
import { Gift } from "iconoir-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { StreakPill } from "~/components/vault/StreakPill";
import { useDailyReward } from "~/components/vault/DailyRewardProvider";
import { formatDailyRewardWait } from "~/lib/vault/next-daily-reward";
import { tweenFast } from "~/lib/design/motion";
import { IconWell } from "./IconWell";

const subscribeNever = () => () => {};
const FALLBACK_LABEL = "Come back tomorrow";
const nextClaimLabel = () => `Next reward in ${formatDailyRewardWait(new Date())}`;

/** "Next reward in 6h" on the client; the server and hydration pass render the always-true fallback (clocks differ). */
const useNextClaimLabel = () =>
  useSyncExternalStore(subscribeNever, nextClaimLabel, () => FALLBACK_LABEL);

function ReadyTile({ streak }: { streak: number }) {
  const { open } = useDailyReward();
  return (
    <Card
      variant="well"
      padding="sm"
      data-slot="daily-reward-tile"
      data-state="ready"
      className="bg-tint-fill border-tint/30 flex items-center gap-3 overflow-hidden border"
    >
      <TextureOverlay texture="chevron" className="[--facet-texture-color:var(--tint)]" />
      <IconWell className="relative">
        <Gift />
      </IconWell>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <span className="text-callout truncate">Daily reward ready</span>
        {streak > 0 && (
          <span className="mt-0.5 flex">
            <StreakPill streak={streak} />
          </span>
        )}
      </div>
      <Button type="button" size="sm" className="relative" onClick={open}>
        Claim daily reward
      </Button>
    </Card>
  );
}

function ClaimedRow() {
  const label = useNextClaimLabel();
  return (
    <div
      data-slot="daily-reward-tile"
      data-state="claimed"
      className="flex items-center gap-3 px-1"
    >
      <Gift aria-hidden className="text-label-secondary size-5 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="text-callout text-label-secondary">Daily reward claimed</span>
        <span className="text-footnote text-label-secondary">{label}</span>
      </div>
    </div>
  );
}

/**
 * The daily reward at the top of the Vault column: a highlighted tile with the Claim button while a reward is
 * waiting, a quiet row once it is claimed. Nothing while the balance loads or fails, so neither state is guessed.
 */
export function DailyRewardTile() {
  const balance = api.vault.getBalance.useQuery();
  if (!balance.data) return null;
  const ready = balance.data.canClaimDailyBonus;
  // The state change remounts the tile, which fades in: an opacity-only tween, so it is also the Reduce Motion form.
  return (
    <motion.div
      key={ready ? "ready" : "claimed"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tweenFast}
    >
      {ready ? <ReadyTile streak={balance.data.loginStreak} /> : <ClaimedRow />}
    </motion.div>
  );
}
