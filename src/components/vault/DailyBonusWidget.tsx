"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import { Coins, Sparks as Sparkles, Trophy, FireFlame as Flame } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

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

export const DailyBonusWidget: React.FC = () => {
  const { userId } = useAuth();
  const utils = api.useUtils();

  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [claiming, setClaiming] = useState<"CREDITS" | "CARD" | null>(null);
  const [claimResult, setClaimResult] = useState<{
    creditsAwarded?: number;
    cardAwarded?: { id: string; title: string; rarity: string; artwork: string };
    streak: number;
    message?: string;
  } | null>(null);

  const { data: balanceData, isLoading } = api.vault.getBalance.useQuery(
    { userId: userId ?? "" },
    { enabled: !!userId }
  );

  // Auto-open modal on first load if claim is available
  useEffect(() => {
    if (balanceData?.canClaimDailyBonus && !hasAutoOpened) {
      setIsOpen(true);
      setHasAutoOpened(true);
    }
  }, [balanceData?.canClaimDailyBonus, hasAutoOpened]);

  const claimMutation = api.vault.claimCombinedDailyClaim.useMutation({
    onSuccess: (data) => {
      setClaimResult(data);
      setClaiming(null);
      vaultNotify.success(data.message ?? "Daily claim successful!");
      void utils.vault.getBalance.invalidate();
      void utils.cards.getMyCards.invalidate();
    },
    onError: (err) => {
      setClaiming(null);
      vaultNotify.error(err.message || "Failed to make daily claim");
    },
  });

  const handleClaim = (choice: "CREDITS" | "CARD") => {
    setClaiming(choice);
    claimMutation.mutate({ choice });
  };

  const handleClose = () => {
    setIsOpen(false);
    // Delay clearing the claim result slightly to avoid flash during exit animation
    setTimeout(() => {
      setClaimResult(null);
    }, 200);
  };

  if (isLoading || !userId) {
    return (
      <div className="border-border bg-muted/40 flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5">
        <div className="bg-muted/60 h-3 w-20 animate-pulse rounded" />
        <div className="bg-muted/60 h-3 w-8 animate-pulse rounded" />
      </div>
    );
  }

  const canClaim = balanceData?.canClaimDailyBonus;

  if (!canClaim && !claimResult && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Clean, integrated trigger box that matches Vault sidebar items perfectly */}
      <div className="w-full">
        {canClaim ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 shadow-sm transition-all hover:bg-amber-500/25 active:scale-[0.98] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15"
          >
            <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 text-left text-[11px] leading-tight select-none">
              Daily Reward
            </span>
            {balanceData?.loginStreak > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 tabular-nums opacity-90 dark:text-amber-300">
                <Flame className="h-2.5 w-2.5 fill-amber-500/25 text-amber-600 dark:text-amber-400" />
                {balanceData.loginStreak}d
              </span>
            )}
          </button>
        ) : (
          <div className="text-muted-foreground border-border bg-muted/40 flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-[10px] select-none">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium">
              <Trophy className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              Daily Claimed
            </span>
            {(balanceData?.loginStreak ?? 0) > 0 && (
              <span className="text-muted-foreground flex items-center gap-0.5 text-[9px] font-medium tabular-nums">
                <Flame className="fill-muted-foreground/20 h-2.5 w-2.5" />
                {balanceData?.loginStreak}d streak
              </span>
            )}
          </div>
        )}
      </div>

      {/* Modal Dialog for choice / result reveal */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="max-w-sm overflow-hidden rounded-2xl border-amber-500/35 p-6 shadow-2xl sm:max-w-md dark:border-amber-500/30">
          <DialogTitle className="sr-only">Daily Reward Choice</DialogTitle>
          <DialogDescription className="sr-only">
            Select your preferred daily reward choice: credits or a card pull.
          </DialogDescription>

          <AnimatePresence mode="wait">
            {!claimResult ? (
              /* Choice Screen */
              <motion.div
                key="choice-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h4 className="text-sm font-semibold tracking-wider text-amber-500 uppercase">
                      Daily Reward
                    </h4>
                  </div>
                  {(balanceData?.loginStreak ?? 0) > 0 && (
                    <div className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[9px] leading-none font-medium text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400">
                      <Flame className="relative -top-[0.5px] h-3 w-3 shrink-0 fill-amber-500/25 text-amber-500" />
                      <span>{balanceData?.loginStreak} Streak</span>
                    </div>
                  )}
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Choose between a payout of IxCredits or a random collectible card. You never know
                  what you'll get!
                </p>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  {/* Credits Option */}
                  <button
                    type="button"
                    onClick={() => handleClaim("CREDITS")}
                    disabled={claiming !== null}
                    className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center transition-all hover:border-amber-500/40 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    <div className="rounded-full bg-amber-500/25 p-3 text-amber-500 transition-transform group-hover:scale-110">
                      <IxCreditsSymbol className="h-6 w-6" />
                    </div>
                    <span className="text-foreground mt-2 text-xs font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      IxCredits
                    </span>
                    <span className="text-muted-foreground mt-0.5 text-[9px] leading-tight">
                      1 to 10,000 IxCredits scaled by level & streak
                    </span>
                  </button>

                  {/* Card Option */}
                  <button
                    type="button"
                    onClick={() => handleClaim("CARD")}
                    disabled={claiming !== null}
                    className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-center transition-all hover:border-blue-500/40 hover:bg-blue-500/10 disabled:opacity-50"
                  >
                    <div className="rounded-full bg-blue-500/25 p-3 text-blue-500 transition-transform group-hover:scale-110">
                      <IxCardIcon className="h-6 w-6" />
                    </div>
                    <span className="text-foreground mt-2 text-xs font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Card Pull
                    </span>
                    <span className="text-muted-foreground mt-0.5 text-[9px] leading-tight">
                      Pulls 1 random card (streak scales rarity)
                    </span>
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Reward Reveal Screen */
              <motion.div
                key="reveal-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center space-y-4 pt-2 text-center"
              >
                <div className="rounded-full bg-amber-500/20 p-3.5 ring-2 ring-amber-500/40">
                  <Sparkles
                    className="h-7 w-7 animate-spin text-amber-500"
                    style={{ animationDuration: "4s" }}
                  />
                </div>

                <div>
                  <h4 className="text-amber-550 text-base font-bold tracking-wider uppercase dark:text-amber-400">
                    Reward Claimed!
                  </h4>
                  <p className="text-muted-foreground mt-1 text-xs">{claimResult.message}</p>
                </div>

                {claimResult.creditsAwarded && (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="dark:text-amber-450 flex items-center gap-1.5 font-mono text-3xl font-bold text-amber-600 tabular-nums sm:text-4xl"
                  >
                    <Coins className="h-8 w-8 shrink-0 text-amber-500 sm:h-9 sm:w-9" />+
                    {claimResult.creditsAwarded.toLocaleString()}
                  </motion.div>
                )}

                {claimResult.cardAwarded && (
                  <motion.div
                    initial={{ y: 20, rotate: -2 }}
                    animate={{ y: 0, rotate: 0 }}
                    className="relative h-48 w-36 overflow-hidden rounded-xl border border-slate-200 bg-black/40 shadow-2xl dark:border-white/15"
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
                    <div className="absolute right-0 bottom-0 left-0 bg-black/85 px-2 py-1.5 text-center">
                      <span className="block truncate text-[10px] font-semibold text-white">
                        {claimResult.cardAwarded.title}
                      </span>
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center gap-1 rounded-full border border-amber-500/15 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Flame className="h-4 w-4 fill-amber-500/20" />
                  {claimResult.streak} Day Streak
                </div>

                <Button
                  size="sm"
                  onClick={handleClose}
                  className="dark:bg-secondary dark:hover:bg-secondary/80 dark:text-foreground w-full bg-slate-900 py-2 text-xs font-bold text-white transition-transform hover:bg-slate-800 active:scale-[0.98]"
                >
                  Collect & Return to Vault
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};
