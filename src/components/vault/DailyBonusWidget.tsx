"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparks as Sparkles,
  Trophy,
  FireFlame as Flame,
  SystemRestart as Loader,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";

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
 * Module-level guard: the widget can be mounted by more than one layout (and remounts on
 * navigation), so remember in-memory as well as in localStorage that today's auto-open happened.
 */
let autoOpenedInSession: string | null = null;

function hasAutoOpenedToday(userId: string): boolean {
  const today = `${userId}:${utcDayKey()}`;
  if (autoOpenedInSession === today) return true;
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
    // Storage unavailable (private mode, blocked) — the in-memory guard still covers this session.
  }
}

/** Seven-day streak strip: filled dots for the days completed in the current week of the streak. */
function StreakStrip({ streak }: { streak: number }) {
  const filled = streak > 0 ? ((streak - 1) % 7) + 1 : 0;
  return (
    <div className="flex items-center gap-1.5" aria-label={`${streak} day streak`}>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i < filled ? "bg-amber-500" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  icon,
  tone,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone: "amber" | "blue";
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
        "group bg-card relative flex min-h-[148px] flex-col items-center justify-center gap-3 rounded-2xl border p-4 text-center transition-[border-color,box-shadow,opacity,transform]",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:scale-[0.98] disabled:cursor-not-allowed",
        tone === "amber"
          ? "border-amber-500/25 enabled:hover:border-amber-500/50"
          : "border-blue-500/25 enabled:hover:border-blue-500/50",
        disabled && !loading && "opacity-50"
      )}
    >
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full transition-transform group-enabled:group-hover:scale-105",
          tone === "amber"
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
        )}
      >
        {loading ? <Loader className="h-6 w-6 animate-spin" /> : icon}
      </span>
      <span className="space-y-1">
        <span className="text-foreground block text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground block text-xs leading-snug">{description}</span>
      </span>
    </button>
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

  // Auto-open at most once per user per (UTC) day — not on every page load or navigation.
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
      void utils.vault.getBalance.invalidate();
      void utils.cards.getMyCards.invalidate();
    },
    onError: (err) => {
      setClaiming(null);
      vaultNotify.error(err.message || "Failed to claim daily reward");
      // The server refuses a second claim (e.g. from another tab) — resync and close.
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
      // Don't allow dismissing mid-claim; the result would be lost.
      if (!open && claiming) return;
      setIsOpen(open);
      if (!open) {
        // Clear after the exit animation to avoid a flash of the choice screen.
        setTimeout(() => setClaimResult(null), 200);
      }
    },
    [claiming]
  );

  if (!userId) return null;

  if (isLoading) {
    return (
      <div className="border-border bg-muted/40 flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-8" />
      </div>
    );
  }

  // Nothing to claim and no reveal in progress — stay out of the sidebar.
  if (!canClaim && !claimResult && !isOpen) return null;

  // Transforms are dropped automatically for reduced-motion users by the root <MotionConfig>.
  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition-[color,background-color,border-color,transform] hover:bg-amber-500/25 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15"
      >
        <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="flex-1 text-left leading-tight select-none">Claim daily reward</span>
        {streak > 0 && (
          <span className="flex items-center gap-0.5 tabular-nums opacity-90">
            <Flame className="h-3 w-3 fill-amber-500/25 text-amber-600 dark:text-amber-400" />
            {streak}d
          </span>
        )}
      </button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={!claiming}
          className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!claimResult ? (
              <motion.div key="choice" {...fade} transition={{ duration: 0.18 }}>
                <div className="space-y-4 px-6 pt-6 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Trophy className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <DialogTitle className="text-foreground text-lg leading-tight font-semibold">
                        Daily reward
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground text-sm">
                        Pick one reward. Come back tomorrow for another.
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="bg-muted/40 space-y-2 rounded-2xl px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground flex items-center gap-1 font-medium">
                        <Flame className="h-3.5 w-3.5 fill-amber-500/25 text-amber-500" />
                        {streak > 0 ? `${streak}-day streak` : "Start a streak today"}
                      </span>
                      <span className="text-muted-foreground">Claim daily to grow bonuses</span>
                    </div>
                    <StreakStrip streak={streak} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ChoiceCard
                      title="IxCredits"
                      description="A random roll boosted by vault level and streak, paid up to your daily earning cap"
                      icon={<IxCreditsSymbol className="h-6 w-6" />}
                      tone="amber"
                      loading={claiming === "CREDITS"}
                      disabled={claiming !== null}
                      onClick={() => handleClaim("CREDITS")}
                    />
                    <ChoiceCard
                      title="Card pull"
                      description="One random collectible card for your collection"
                      icon={<IxCardIcon className="h-6 w-6" />}
                      tone="blue"
                      loading={claiming === "CARD"}
                      disabled={claiming !== null}
                      onClick={() => handleClaim("CARD")}
                    />
                  </div>
                </div>

                <div className="border-border border-t px-6 py-3">
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    disabled={claiming !== null}
                    className="text-muted-foreground hover:text-foreground w-full rounded-lg py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Maybe later
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="reveal"
                {...fade}
                transition={{ duration: 0.22 }}
                className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center"
              >
                <DialogTitle className="sr-only">Reward claimed</DialogTitle>
                <DialogDescription className="sr-only">
                  {claimResult.message ?? "Your daily reward has been added."}
                </DialogDescription>

                {claimResult.creditsAwarded != null && (
                  <>
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 text-amber-600 ring-8 ring-amber-500/5 dark:text-amber-400"
                    >
                      <IxCreditsSymbol className="h-8 w-8" />
                    </motion.span>
                    <div>
                      <p className="text-foreground font-mono text-4xl font-bold tabular-nums">
                        +{claimResult.creditsAwarded.toLocaleString()}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        IxCredits added to your vault
                      </p>
                    </div>
                  </>
                )}

                {claimResult.cardAwarded && (
                  <>
                    <motion.div
                      initial={{ y: 16, rotate: -3, opacity: 0 }}
                      animate={{ y: 0, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 220, damping: 20 }}
                      className="border-border relative h-56 w-40 overflow-hidden rounded-2xl border bg-black/40 shadow-2xl"
                    >
                      <CardHolographicCover
                        cardType="LORE"
                        rarity={claimResult.cardAwarded.rarity}
                        title={claimResult.cardAwarded.title}
                      />
                      {claimResult.cardAwarded.artwork && (
                        <img
                          src={claimResult.cardAwarded.artwork}
                          alt={claimResult.cardAwarded.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-black/40 px-2.5 py-2 text-left">
                        <span className="block truncate text-xs font-semibold text-white">
                          {claimResult.cardAwarded.title}
                        </span>
                        <span className="block text-xs text-white/70 capitalize">
                          {claimResult.cardAwarded.rarity.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </div>
                    </motion.div>
                    <p className="text-muted-foreground text-sm">Added to your collection</p>
                  </>
                )}

                <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <Flame className="h-3.5 w-3.5 fill-amber-500/25" />
                  {claimResult.streak}-day streak
                  <Sparkles className="h-3.5 w-3.5" />
                </div>

                <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row-reverse">
                  <Button className="flex-1" onClick={() => handleOpenChange(false)}>
                    Done
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
