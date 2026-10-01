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
        <div className="rounded-row border-yellow/25 bg-yellow/10 shadow-card relative overflow-hidden border p-3.5">
          <button
            onClick={onDismissNotice}
            className="text-label-secondary hover:text-label hover:bg-fill-3 absolute top-2.5 right-2.5 rounded-full p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            aria-label="Dismiss notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex gap-3">
            <div className="rounded-control bg-yellow/20 text-yellow flex h-8 w-8 shrink-0 items-center justify-center">
              <Book className="h-4 w-4" />
            </div>
            <div className="space-y-1 pr-4">
              <h4 className="text-label text-footnote font-semibold">Start your collection</h4>
              <p className="text-label-secondary text-footnote leading-relaxed">
                Browse the lore Card Gallery, collect the nations and figures of the world, and earn
                IxCredits as your collection grows.
              </p>
              <button
                onClick={() => onNavigate?.("cards")}
                className="text-footnote text-yellow mt-1.5 inline-flex items-center gap-1 font-semibold hover:underline"
              >
                Open the Card Gallery <ArrowRight className="h-2.5 w-2.5" />
              </button>
              {hasImported === false && (
                <p className="text-label-secondary text-footnote pt-1 leading-relaxed">
                  Play NationStates?{" "}
                  <button
                    onClick={() => onNavigate?.("import")}
                    className="text-yellow font-semibold hover:underline"
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
