"use client";

import { springSmooth } from "~/lib/design/motion";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, FireFlame as Flame, SystemRestart as Loader } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
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

/** Seven-day streak progress: how far into the current week of the streak the player is. */
function StreakProgress({ streak }: { streak: number }) {
  const filled = streak > 0 ? ((streak - 1) % 7) + 1 : 0;
  return (
    <Progress
      value={(filled / 7) * 100}
      aria-label="Streak this week"
      aria-valuetext={`${filled} of 7 days`}
      className="bg-fill-3 h-1.5"
      indicatorClassName="bg-yellow"
    />
  );
}

function ChoiceCard({
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
        "group rounded-card text-left transition-[opacity,transform] duration-150",
        "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2",
        "enabled:active:scale-[0.98] disabled:cursor-not-allowed",
        disabled && !loading && "opacity-50"
      )}
    >
      {/* Interactive row (depth 3) inside the dialog: solid, so blur never stacks. */}
      <FacetCard className="duration-fast group-enabled:group-hover:border-tint/50 flex h-full min-h-[148px] flex-col items-center justify-center gap-3 p-4 text-center transition-[border-color]">
        <span aria-hidden="true" className="grid h-8 place-items-center">
          {loading ? <Loader className="text-label-secondary h-6 w-6 animate-spin" /> : icon}
        </span>
        <span className="space-y-1">
          <span className="text-label text-headline block">{title}</span>
          <span className="text-label-secondary text-footnote block leading-snug">
            {description}
          </span>
        </span>
      </FacetCard>
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
    return <Skeleton className="h-8 w-full" />;
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="border-yellow/40 text-footnote w-full justify-start gap-2 px-2.5 font-semibold"
      >
        <Trophy aria-hidden="true" className="text-yellow h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left leading-tight select-none">Claim daily reward</span>
        {streak > 0 && (
          <span className="text-label-secondary flex items-center gap-0.5 tabular-nums">
            <Flame aria-hidden="true" className="text-yellow h-3 w-3" />
            {streak}d
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={!claiming}
          className="rounded-card max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!claimResult ? (
              <motion.div key="choice" {...fade} transition={springSmooth}>
                <div className="space-y-4 px-6 pt-6 pb-5">
                  <div className="flex items-start gap-3 pr-6">
                    <Trophy aria-hidden="true" className="text-yellow mt-0.5 h-6 w-6 shrink-0" />
                    <div className="min-w-0">
                      <DialogTitle className="text-label text-title-3 leading-tight font-semibold">
                        Daily reward
                      </DialogTitle>
                      <DialogDescription className="text-label-secondary text-body">
                        Pick one reward. Come back tomorrow for another.
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label text-body flex items-center gap-1 font-medium">
                        <Flame aria-hidden="true" className="text-yellow h-4 w-4" />
                        {streak > 0 ? `${streak}-day streak` : "Start a streak today"}
                      </span>
                      <Eyebrow>Claim daily to grow bonuses</Eyebrow>
                    </div>
                    <StreakProgress streak={streak} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ChoiceCard
                      title="IxCredits"
                      description="A random roll boosted by vault level and streak, paid up to your daily earning cap"
                      icon={<IxCreditsSymbol className="text-yellow h-6 w-6" />}
                      loading={claiming === "CREDITS"}
                      disabled={claiming !== null}
                      onClick={() => handleClaim("CREDITS")}
                    />
                    <ChoiceCard
                      title="Card pull"
                      description="One random collectible card for your collection"
                      icon={<IxCardIcon className="text-label-secondary h-6 w-6" />}
                      loading={claiming === "CARD"}
                      disabled={claiming !== null}
                      onClick={() => handleClaim("CARD")}
                    />
                  </div>
                </div>

                <div className="border-separator border-t px-6 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={claiming !== null}
                    className="text-label-secondary w-full"
                  >
                    Maybe later
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="reveal"
                {...fade}
                transition={springSmooth}
                className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center"
              >
                <DialogTitle className="sr-only">Reward claimed</DialogTitle>
                <DialogDescription className="sr-only">
                  {claimResult.message ?? "Your daily reward has been added."}
                </DialogDescription>

                {claimResult.creditsAwarded != null && (
                  <>
                    <motion.span
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                      className="text-yellow"
                    >
                      <IxCreditsSymbol className="h-10 w-10" />
                    </motion.span>
                    <div>
                      <p className="text-label text-large-title tabular-nums">
                        +{claimResult.creditsAwarded.toLocaleString()}
                      </p>
                      <p className="text-label-secondary text-body mt-1">
                        IxCredits added to your vault
                      </p>
                    </div>
                  </>
                )}

                {claimResult.cardAwarded && (
                  <>
                    <motion.div
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                      className="border-separator bg-fill-3 rounded-card relative h-56 w-40 overflow-hidden border"
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
                    </motion.div>
                    <div className="space-y-1.5">
                      <p className="text-label text-headline max-w-60 truncate">
                        {claimResult.cardAwarded.title}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {claimResult.cardAwarded.rarity.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                        <span className="text-label-secondary text-body">
                          Added to your collection
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <Badge variant="outline" className="border-yellow/40">
                  <Flame aria-hidden="true" className="text-yellow" />
                  {claimResult.streak}-day streak
                </Badge>

                <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row-reverse">
                  <Button
                    className="bg-yellow text-on-yellow hover:bg-yellow/90 flex-1"
                    onClick={() => handleOpenChange(false)}
                  >
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
