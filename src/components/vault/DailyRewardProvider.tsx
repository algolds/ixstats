"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { DailyRewardDialog } from "./daily-reward/DailyRewardDialog";

interface DailyRewardContextValue {
  open: () => void;
  isOpen: boolean;
}

const DailyRewardContext = createContext<DailyRewardContextValue | null>(null);

function useDailyRewardContext(): DailyRewardContextValue {
  const ctx = useContext(DailyRewardContext);
  if (!ctx) throw new Error("useDailyReward must be used inside <DailyRewardProvider>");
  return ctx;
}

/** Opens the daily reward dialog from anywhere under the provider (the sidebar row, page content). */
export function useDailyReward(): { open: () => void } {
  const { open } = useDailyRewardContext();
  return { open };
}

export function DailyRewardProvider({
  children,
  autoOpen = true,
}: {
  children: React.ReactNode;
  /** Open the dialog by itself once a day when a reward is claimable. */
  autoOpen?: boolean;
}) {
  const { userId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open, isOpen }), [open, isOpen]);

  return (
    <DailyRewardContext.Provider value={value}>
      {children}
      {userId && (
        <DailyRewardDialog
          userId={userId}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          autoOpen={autoOpen}
        />
      )}
    </DailyRewardContext.Provider>
  );
}

/** The claimable button, or the "Daily claimed" row once today's reward is taken. */
export function DailyRewardStatus() {
  const { userId } = useAuth();
  const { open, isOpen } = useDailyRewardContext();
  const { data: balanceData, isLoading } = api.vault.getBalance.useQuery(undefined, {
    enabled: !!userId,
  });

  if (!userId) return null;
  if (isLoading) return <Skeleton className="h-8 w-full" />;

  const canClaim = balanceData?.canClaimDailyBonus ?? false;

  if (!canClaim && !isOpen) {
    return (
      <div
        data-slot="daily-reward-claimed"
        className="bg-fill-4 text-label-secondary text-footnote rounded-control flex min-h-(--control-height-sm) w-full items-center gap-2 px-3 select-none"
      >
        <Trophy aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 whitespace-nowrap">Daily claimed</span>
      </div>
    );
  }

  return (
    <div data-app="vault">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={open}
        className="bg-tint-fill text-tint-ink hover:bg-tint-fill hover:text-tint active:bg-tint-fill text-footnote w-full justify-start gap-2 px-3 font-semibold"
      >
        <Trophy aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 text-left whitespace-nowrap">Daily reward</span>
      </Button>
    </div>
  );
}
