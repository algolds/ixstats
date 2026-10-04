"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, FireFlame as Flame, SystemRestart as Loader } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { soundCues } from "~/lib/sound/cuelume";
import { springGentle, springSmooth } from "~/lib/design/motion";
import { cn } from "~/lib/utils";

const IxCardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
    <path d="M5 9h14" />
    <path d="M5 15h14" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);

type ClaimChoice = "CREDITS" | "CARD";

interface ClaimResult {
  creditsAwarded?: number;
  cardAwarded?: { id: string; title: string; rarity: string; artwork: string };
  streak: number;
  message?: string;
}

/** Daily claims reset at 00:00 UTC on the server, so the auto-open key follows the same day. */
const utcDayKey = () => new Date().toISOString().slice(0, 10);
const autoOpenStorageKey = (userId: string) => `ixstats:dailyReward:autoOpened:${userId}`;

/**
 * The widget can be mounted by more than one layout and remounts on navigation, so today's
 * auto-open is remembered in memory as well as in localStorage.
 */
let autoOpenedInSession: string | null = null;

function hasAutoOpenedToday(userId: string): boolean {
  if (autoOpenedInSession === `${userId}:${utcDayKey()}`) return true;
  try {
    return window.localStorage.getItem(autoOpenStorageKey(userId)) === utcDayKey();
  } catch {
    return false;
  }
}

function markAutoOpenedToday(userId: string) {
  autoOpenedInSession = `${userId}:${utcDayKey()}`;
  try {
    window.localStorage.setItem(autoOpenStorageKey(userId), utcDayKey());
  } catch {
    // Storage unavailable (private mode, blocked): the in-memory guard still covers this session.
  }
}

function StreakPill({ streak }: { streak: number }) {
  return (
    <span className="bg-tint-fill text-tint-ink text-footnote inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-medium tabular-nums">
      <Flame aria-hidden className="size-3.5" />
      {streak > 0 ? `${streak}-day streak` : "New streak"}
    </span>
  );
}

function ChoiceTile({
  title,
  description,
  icon,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading}
      className={cn(
        "facet-well facet-press rounded-row flex min-h-36 flex-col items-center justify-center gap-3 p-4 text-center",
        "enabled:hover:bg-tint-fill focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        disabled && !loading && "opacity-50"
      )}
    >
      <span
        aria-hidden
        className="bg-tint-fill text-tint grid size-12 place-items-center rounded-full"
      >
        {loading ? <Loader className="size-6 animate-spin" /> : icon}
      </span>
      <span className="space-y-1">
        <span className="text-headline text-label block">{title}</span>
        <span className="text-footnote text-label-secondary block leading-snug">
          {description}
        </span>
      </span>
    </button>
  );
}

function CreditsReveal({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springGentle}
      className="flex flex-col items-center gap-1"
    >
      <span className="text-tint flex items-center gap-2">
        <IxCreditsSymbol decorative className="size-9" />
        <span className="text-large-title tabular-nums">+{amount.toLocaleString()}</span>
      </span>
      <p className="text-body text-label-secondary">IxCredits added to your vault</p>
    </motion.div>
  );
}

function CardReveal({ card }: { card: NonNullable<ClaimResult["cardAwarded"]> }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        initial={{ y: 12, rotate: -2, opacity: 0 }}
        animate={{ y: 0, rotate: 0, opacity: 1 }}
        transition={springGentle}
        className="rounded-card shadow-floating relative h-56 w-40 overflow-hidden"
      >
        <CardHolographicCover cardType="LORE" rarity={card.rarity} title={card.title} />
        {card.artwork && (
          <img
            src={card.artwork}
            alt={card.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="bg-surface-elevated text-label text-footnote absolute inset-x-0 bottom-0 truncate px-2 py-2 font-semibold">
          {card.title}
        </span>
      </motion.div>
      <Badge variant="secondary" className="capitalize">
        {card.rarity.toLowerCase().replace(/_/g, " ")}
      </Badge>
    </div>
  );
}

export const DailyBonusWidget: React.FC = () => {
  const { userId } = useAuth();
  const utils = api.useUtils();

  const [isOpen, setIsOpen] = useState(false);
  const [claiming, setClaiming] = useState<ClaimChoice | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  const { data: balanceData, isLoading } = api.vault.getBalance.useQuery(undefined, {
    enabled: !!userId,
  });

  const canClaim = balanceData?.canClaimDailyBonus ?? false;
  const streak = balanceData?.loginStreak ?? 0;

  // Auto-open at most once per user per UTC day, not on every page load or navigation.
  useEffect(() => {
    if (!userId || !canClaim || hasAutoOpenedToday(userId)) return;
    markAutoOpenedToday(userId);
    // oxlint-disable-next-line
    setIsOpen(true);
  }, [userId, canClaim]);

  const claimMutation = api.vault.claimCombinedDailyClaim.useMutation({
    onSuccess: (data) => {
      setClaiming(null);
      setClaimResult(data);
      soundCues?.reveal?.();
      void utils.vault.getBalance.invalidate();
      void utils.cards.getMyCards.invalidate();
    },
    onError: (err) => {
      setClaiming(null);
      vaultNotify.error(err.message || "Couldn't claim the daily reward");
      // The server refuses a second claim (another tab, another device): resync and close.
      void utils.vault.getBalance.invalidate();
      if (/already/i.test(err.message)) setIsOpen(false);
    },
  });

  const handleClaim = (choice: ClaimChoice) => {
    if (claiming) return;
    setClaiming(choice);
    claimMutation.mutate({ choice });
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Closing mid-claim would lose the result.
      if (!open && claiming) return;
      setIsOpen(open);
      // Clear after the exit animation so the choice screen does not flash.
      if (!open) setTimeout(() => setClaimResult(null), 200);
    },
    [claiming]
  );

  if (!userId) return null;
  if (isLoading) return <Skeleton className="h-8 w-full" />;

  const showClaimed = !canClaim && !claimResult && !isOpen;

  // Transforms are dropped for reduced-motion users by the root <MotionConfig>.
  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <>
      {showClaimed ? (
        <div
          data-slot="daily-reward-claimed"
          className="bg-fill-4 text-label-secondary text-footnote rounded-control flex min-h-(--control-height-sm) w-full items-center gap-2 px-3 select-none"
        >
          <Trophy aria-hidden className="size-3.5 shrink-0" />
          <span className="flex-1">Daily claimed</span>
          {streak > 0 && <span className="tabular-nums">· {streak}d streak</span>}
        </div>
      ) : (
        <div data-app="vault">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="bg-tint-fill text-tint-ink text-footnote w-full justify-start gap-2 px-3 font-semibold"
          >
            <Trophy aria-hidden className="size-3.5 shrink-0" />
            <span className="flex-1 text-left">Daily reward</span>
            {streak > 0 && (
              <span className="flex items-center gap-1 tabular-nums">
                <Flame aria-hidden className="size-3" />
                {streak}d
              </span>
            )}
          </Button>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          data-app="vault"
          showCloseButton={!claiming}
          className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!claimResult ? (
              <motion.div key="choice" {...fade} transition={springSmooth} className="space-y-5 p-6">
                <div className="flex items-center gap-3 pr-8">
                  <Trophy aria-hidden className="text-tint size-6 shrink-0" />
                  <DialogTitle className="text-title-3 text-label flex-1">Daily reward</DialogTitle>
                  <StreakPill streak={streak} />
                </div>
                <DialogDescription className="sr-only">
                  Choose IxCredits or a card pull. You can claim again tomorrow.
                </DialogDescription>
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceTile
                    title="IxCredits"
                    description="Random roll, boosted by level and streak"
                    icon={<IxCreditsSymbol decorative className="size-6" />}
                    loading={claiming === "CREDITS"}
                    disabled={claiming !== null}
                    onClick={() => handleClaim("CREDITS")}
                  />
                  <ChoiceTile
                    title="Card pull"
                    description="One random card"
                    icon={<IxCardIcon className="size-6" />}
                    loading={claiming === "CARD"}
                    disabled={claiming !== null}
                    onClick={() => handleClaim("CARD")}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="reveal"
                data-content="reveal"
                {...fade}
                transition={springSmooth}
                className="flex flex-col items-center gap-5 px-6 pt-8 pb-6 text-center"
              >
                <DialogTitle className="text-title-3 text-label">Reward claimed</DialogTitle>
                <DialogDescription className="sr-only">
                  {claimResult.message ?? "Your daily reward has been added."}
                </DialogDescription>

                {claimResult.creditsAwarded != null && (
                  <CreditsReveal amount={claimResult.creditsAwarded} />
                )}
                {claimResult.cardAwarded && <CardReveal card={claimResult.cardAwarded} />}

                <StreakPill streak={claimResult.streak} />

                <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
                  <Button className="flex-1" onClick={() => handleOpenChange(false)}>
                    Collect
                  </Button>
                  {claimResult.cardAwarded && (
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href="/vault/inventory" onClick={() => handleOpenChange(false)}>
                        View collection
                      </Link>
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};
