"use client";

import React from "react";
import { Book, ArrowRight, Xmark as X } from "iconoir-react";
import { VaultCardHoldingsCard } from "./VaultCardHoldingsCard";
import { VaultMilestonesCard } from "./VaultMilestonesCard";
import type { CardInstance } from "~/types/cards-display";

export interface VaultShowcaseGridProps {
  hasImported?: boolean;
  isNoticeDismissed: boolean;
  onDismissNotice: () => void;
  onNavigate?: (section: string) => void;
  featuredCards: CardInstance[];
  topCardsLoading: boolean;
  myAchievements?: Array<{ points?: number }>;
  leaderboard?: Array<{ countryId?: string }>;
  userCountryId?: string;
  totalCards: number;
  creditsBalance: number;
  getRarityGlow: (rarity?: string | null) => string;
  getRarityBorder: (rarity?: string | null) => string;
}

export function VaultShowcaseGrid({
  hasImported,
  isNoticeDismissed,
  onDismissNotice,
  onNavigate,
  featuredCards,
  topCardsLoading,
  myAchievements,
  leaderboard,
  userCountryId,
  totalCards,
  creditsBalance,
  getRarityGlow,
  getRarityBorder,
}: VaultShowcaseGridProps) {
  return (
    <div className="facet-layout-sidebar-span-1 space-y-6">
      {!isNoticeDismissed && (
        <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 shadow-sm backdrop-blur-md dark:border-amber-500/15">
          <button
            onClick={onDismissNotice}
            className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5 rounded-full p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-white/10"
            aria-label="Dismiss notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Book className="h-4 w-4" />
            </div>
            <div className="space-y-1 pr-4">
              <h4 className="text-foreground text-xs font-bold tracking-tight">
                Start your collection
              </h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Browse the lore Card Gallery, collect the nations and figures of the world, and earn
                IxCredits as your collection grows.
              </p>
              <button
                onClick={() => onNavigate?.("cards")}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-500 hover:underline dark:text-amber-400"
              >
                Open the Card Gallery <ArrowRight className="h-2.5 w-2.5" />
              </button>
              {hasImported === false && (
                <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
                  Play NationStates?{" "}
                  <button
                    onClick={() => onNavigate?.("import")}
                    className="font-semibold text-amber-600 hover:text-amber-500 hover:underline dark:text-amber-400"
                  >
                    Import your deck
                  </button>{" "}
                  too.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Card Holdings (Top Right) */}
      <VaultCardHoldingsCard
        featuredCards={featuredCards}
        topCardsLoading={topCardsLoading}
        onNavigate={onNavigate}
        getRarityGlow={getRarityGlow}
        getRarityBorder={getRarityBorder}
      />

      {/* 2. Achievements & Vault Milestones */}
      <VaultMilestonesCard
        myAchievements={myAchievements}
        leaderboard={leaderboard}
        userCountryId={userCountryId}
        totalCards={totalCards}
        creditsBalance={creditsBalance}
      />
    </div>
  );
}
