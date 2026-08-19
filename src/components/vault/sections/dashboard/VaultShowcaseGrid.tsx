"use client";

import React from "react";
import { Download, ArrowRight, X } from "lucide-react";
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
      {hasImported === false && !isNoticeDismissed && (
        <div className="relative overflow-hidden rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5 shadow-sm backdrop-blur-md dark:border-rose-500/15">
          <button
            onClick={onDismissNotice}
            className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5 rounded-full p-1 transition-all hover:bg-white/10"
            aria-label="Dismiss notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <Download className="h-4 w-4 animate-bounce" />
            </div>
            <div className="space-y-1 pr-4">
              <h4 className="text-foreground text-xs font-bold tracking-tight">
                Import NationStates Cards!
              </h4>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                You haven't imported your NationStates deck yet. Verify your nation and import your
                collection to earn bonus IxCredits!
              </p>
              <button
                onClick={() => onNavigate?.("import")}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-500 hover:underline dark:text-rose-400"
              >
                Go to Importer <ArrowRight className="h-2.5 w-2.5" />
              </button>
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
