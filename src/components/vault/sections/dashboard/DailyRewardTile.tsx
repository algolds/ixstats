"use client";

import { useSyncExternalStore } from "react";
import { Gift } from "iconoir-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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

function ReadyTile() {
  const { open } = useDailyReward();
  return (
    <Card
      variant="well"
      padding="sm"
      data-slot="daily-reward-tile"
      data-state="ready"
      className="bg-tint-fill border-tint/30 flex flex-wrap items-center gap-3 border"
    >
      <IconWell>
        <Gift />
      </IconWell>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-callout truncate">Daily reward ready</span>
        <span className="text-footnote text-label-secondary truncate">
          IxCredits or a mystery card
        </span>
      </div>
      <Button type="button" size="sm" onClick={open}>
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
        <span className="text-footnote text-label-secondary tabular-nums">{label}</span>
      </div>
    </div>
  );
}

/**
 * Daily reward prompt: a 1-tap claim tile while a reward is waiting, or a quiet status line once claimed.
 * Pass `onlyWhenReady` inside the Wallet balance hero so claimed days leave the statement summary uncluttered.
 */
export function DailyRewardTile({ onlyWhenReady = false }: { onlyWhenReady?: boolean }) {
  const balance = api.vault.getBalance.useQuery();
  if (!balance.data) return null;
  const ready = balance.data.canClaimDailyBonus;
  if (onlyWhenReady && !ready) return null;

  return (
    <motion.div
      key={ready ? "ready" : "claimed"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tweenFast}
    >
      {ready ? <ReadyTile /> : <ClaimedRow />}
    </motion.div>
  );
}
