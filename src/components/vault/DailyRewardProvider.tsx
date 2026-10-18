"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, SystemRestart as Loader } from "iconoir-react";
import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Progress } from "~/components/ui/progress";
import { Stat } from "~/components/ui/stat";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { StreakPill } from "~/components/vault/StreakPill";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import type { CardFaceData } from "~/lib/cards/face/types";
import { soundCues } from "~/lib/sound/cuelume";
import { springGentle, springSmooth } from "~/lib/design/motion";
import { STREAK_BOOST_FULL_DAYS, levelMultiplier, streakMultiplier } from "~/lib/vault/daily-roll";
import { cn } from "~/lib/utils";

type ClaimChoice = "CREDITS" | "CARD";

interface ClaimResult {
  creditsAwarded?: number;
  /** The pulled card, kept for when its face could not be read after the claim committed. */
  cardAwarded?: { id: string; title: string };
  /** The pulled copy's face; null for a credits claim. */
  cardFace?: CardFaceData | null;
  streak: number;
  message?: string;
}

/** Daily claims reset at 00:00 UTC on the server, so the auto-open key follows the same day. */
const utcDayKey = () => new Date().toISOString().slice(0, 10);
const autoOpenStorageKey = (userId: string) => `ixstats:dailyReward:autoOpened:${userId}`;

/**
 * The provider remounts on a full reload and the dialog can remount with it, so today's
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

/** The roll's boost for today's claim, as the server applies it (`lib/vault/daily-roll.ts`). */
const formatBoost = (multiplier: number) => `×${multiplier.toFixed(2)}`;

/** Time until the next claim opens at 00:00 UTC, e.g. "9h 12m". */
function untilNextClaim(now = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(1, Math.ceil((next - now.getTime()) / 60_000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

/**
 * A choice: a raised pane that lifts on hover and presses in, its art set into a recessed socket.
 * The socket sits 4px inside the tile so the radii stay concentric (card 16, row 12).
 */
function ChoiceTile({
  title,
  detail,
  figure,
  figureTitle,
  art,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  figure?: string;
  figureTitle?: string;
  art: React.ReactNode;
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
        "facet-pane facet-press facet-press-subtle rounded-card flex flex-col p-1 text-left",
        "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        !disabled && "facet-lift",
        disabled && !loading && "opacity-50"
      )}
    >
      <span
        aria-hidden
        className="facet-recess rounded-row grid h-32 place-items-center overflow-hidden"
      >
        {loading ? <Loader className="text-tint size-6 animate-spin" /> : art}
      </span>
      <span className="block px-3 pt-3 pb-2">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-headline text-label">{title}</span>
          {figure && (
            <span title={figureTitle} className="text-tint text-headline shrink-0 tabular-nums">
              {figure}
            </span>
          )}
        </span>
        <span className="text-footnote text-label-secondary block">{detail}</span>
      </span>
    </button>
  );
}

/**
 * A card face down and tilted in its socket: the pull is a card you have not seen. The socket is 128px tall, so the
 * card is narrower than size S to fit it.
 */
function FaceDownCard() {
  return <CardFaceDown size="S" className="w-20 -rotate-2" />;
}

/** Progress toward the full streak boost, in a well under the choices. */
function StreakBoostWell({ claimStreak }: { claimStreak: number }) {
  const full = claimStreak >= STREAK_BOOST_FULL_DAYS;
  return (
    <div className="facet-well rounded-card space-y-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-subhead text-label">Streak boost</span>
        <span className="text-tint text-headline tabular-nums">
          {formatBoost(streakMultiplier(claimStreak))}
        </span>
      </div>
      <Progress
        value={Math.min(claimStreak, STREAK_BOOST_FULL_DAYS)}
        max={STREAK_BOOST_FULL_DAYS}
        aria-label="Streak boost progress"
      />
      <p className="text-footnote text-label-secondary">
        {full
          ? "Full boost. Claim every day to keep it."
          : `Day ${claimStreak} today. The boost peaks at ${formatBoost(streakMultiplier(STREAK_BOOST_FULL_DAYS))} on day ${STREAK_BOOST_FULL_DAYS}.`}
      </p>
    </div>
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
        <IxCreditsSymbol decorative className="size-10" />
        <span className="text-large-title tabular-nums">+{amount.toLocaleString()}</span>
      </span>
      <p className="text-body text-label-secondary">IxCredits added to your vault</p>
    </motion.div>
  );
}

/** The pulled copy's own face, turned over. */
function CardReveal({ face }: { face: CardFaceData }) {
  return (
    <motion.div
      initial={{ y: 12, rotate: -2, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={springGentle}
    >
      <CardFace face={face} size="M" />
    </motion.div>
  );
}

/** Streak and the next claim, as a two-figure well under the reward. */
function ClaimFacts({ streak }: { streak: number }) {
  return (
    <div className="facet-well rounded-card divide-separator grid w-full grid-cols-2 divide-x text-left">
      <Stat
        size="sm"
        className="p-4"
        label="Streak"
        value={`${streak} ${streak === 1 ? "day" : "days"}`}
      />
      <Stat size="sm" className="p-4" label="Next reward" value={`in ${untilNextClaim()}`} />
    </div>
  );
}

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

function DailyRewardDialog({
  userId,
  isOpen,
  setIsOpen,
  autoOpen,
}: {
  userId: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  autoOpen: boolean;
}) {
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();

  const [claiming, setClaiming] = useState<ClaimChoice | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  const { data: balanceData } = api.vault.getBalance.useQuery(undefined);

  const canClaim = balanceData?.canClaimDailyBonus ?? false;
  const streak = balanceData?.loginStreak ?? 0;
  const claimStreak = balanceData?.claimStreak ?? streak;
  const levelBoost = levelMultiplier(balanceData?.vaultLevel ?? 1);
  const streakBoost = streakMultiplier(claimStreak);

  // Auto-open at most once per user per UTC day, not on every page load or navigation. Routes
  // without chrome (maps, full-screen editors) opt out, and do not spend the day's auto-open.
  useEffect(() => {
    if (!autoOpen || !canClaim || hasAutoOpenedToday(userId)) return;
    markAutoOpenedToday(userId);
    setIsOpen(true);
  }, [autoOpen, userId, canClaim, setIsOpen]);

  // A claim (or a refused one) moves the balance, the statement and today's earnings.
  const refreshVault = () => {
    void utils.vault.getBalance.invalidate();
    void utils.vault.getTransactions.invalidate();
    void utils.vault.getTodayEarnings.invalidate();
  };

  const claimMutation = api.vault.claimCombinedDailyClaim.useMutation({
    onSuccess: (data) => {
      setClaiming(null);
      setClaimResult(data);
      soundCues?.reveal?.();
      refreshVault();
      // A card pull is a new copy: Mine, the display and Explore read it.
      refreshCards();
    },
    onError: (err) => {
      setClaiming(null);
      vaultNotify.error(err.message || "Couldn't claim the daily reward");
      // The server refuses a second claim (another tab, another device): resync and close.
      refreshVault();
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
    [claiming, setIsOpen]
  );

  const pulledCardId = claimResult?.cardFace?.cardId ?? claimResult?.cardAwarded?.id;

  // Transforms are dropped for reduced-motion users by the root <MotionConfig>.
  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        data-app="vault"
        showCloseButton={!claiming}
        className="isolate max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {/* The reveal's art stage: the pulled card's art, full bleed behind the overlay's content. */}
        {claimResult?.cardFace?.artwork && (
          <img
            aria-hidden
            alt=""
            src={proxyCardArtwork(claimResult.cardFace.artwork)}
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-20"
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {!claimResult ? (
            <motion.div key="choice" {...fade} transition={springSmooth} className="space-y-4 p-6">
              <div className="flex items-center gap-3 pr-8">
                <span
                  aria-hidden
                  className="facet-recess rounded-control text-tint grid size-10 shrink-0 place-items-center"
                >
                  <Trophy className="size-5" />
                </span>
                <DialogTitle className="text-title-3 text-label flex-1">Daily reward</DialogTitle>
              </div>
              <DialogDescription className="sr-only">
                Choose IxCredits or a card pull. You can claim again tomorrow.
              </DialogDescription>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceTile
                  title="IxCredits"
                  detail="Random roll"
                  figure={formatBoost(streakBoost * levelBoost)}
                  figureTitle={`Streak ${formatBoost(streakBoost)}, vault level ${formatBoost(levelBoost)}`}
                  art={<IxCreditsSymbol decorative className="text-tint size-12" />}
                  loading={claiming === "CREDITS"}
                  disabled={claiming !== null}
                  onClick={() => handleClaim("CREDITS")}
                />
                <ChoiceTile
                  title="Card pull"
                  detail="One random card"
                  art={<FaceDownCard />}
                  loading={claiming === "CARD"}
                  disabled={claiming !== null}
                  onClick={() => handleClaim("CARD")}
                />
              </div>
              <StreakBoostWell claimStreak={claimStreak} />
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
              {claimResult.cardFace && <CardReveal face={claimResult.cardFace} />}
              {!claimResult.cardFace && claimResult.cardAwarded && (
                <p className="text-headline text-label">{claimResult.cardAwarded.title}</p>
              )}

              <ClaimFacts streak={claimResult.streak} />

              <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
                <Button className="sm:flex-1" onClick={() => handleOpenChange(false)}>
                  Collect
                </Button>
                {pulledCardId && (
                  <Button variant="outline" className="sm:flex-1" asChild>
                    <Link
                      href={cardSheetHref(CARD_HUB_PATHS.mine, pulledCardId)}
                      onClick={() => handleOpenChange(false)}
                    >
                      View card
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
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
  const streak = balanceData?.loginStreak ?? 0;

  if (!canClaim && !isOpen) {
    return (
      <div
        data-slot="daily-reward-claimed"
        className="bg-fill-4 text-label-secondary text-footnote rounded-control flex min-h-(--control-height-sm) w-full items-center gap-2 px-3 select-none"
      >
        <Trophy aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1">Daily claimed</span>
        {streak > 0 && <StreakPill streak={streak} />}
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
        <span className="flex-1 text-left">Daily reward</span>
        {streak > 0 && <StreakPill streak={streak} />}
      </Button>
    </div>
  );
}
