"use client";

import React from "react";
import { Book, ArrowRight, Xmark as X } from "iconoir-react";
import { VaultCardHoldingsCard } from "./VaultCardHoldingsCard";
import { VaultMilestonesCard } from "./VaultMilestonesCard";
import type { CardInstance } from "~/types/cards-display";
import { Button } from "~/components/ui/button";

interface VaultShowcaseGridProps {
  hasImported?: boolean;
  isNoticeDismissed: boolean;
  onDismissNotice: () => void;
  onNavigate?: (section: string) => void;
  featuredCards: CardInstance[];
  topCardsLoading: boolean;
  myAchievements?: Array<{ points?: number }>;
  leaderboard?: Array<{ countryId?: string }>;
  userCountryId?: string;
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
}: VaultShowcaseGridProps) {
  return (
    <div className="flex flex-col space-y-6">
      {!isNoticeDismissed && (
        <div className="rounded-row border-yellow/25 bg-yellow/10 shadow-card relative overflow-hidden border p-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDismissNotice}
            aria-label="Dismiss notice"
            className="text-label-secondary absolute top-2 right-2 rounded-full"
          >
            <X className="h-3.5 w-3.5" />
          </Button>

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
              <Button
                variant="link"
                size="sm"
                onClick={() => onNavigate?.("cards")}
                className="text-footnote text-yellow mt-2 h-auto gap-1 px-0 font-semibold"
              >
                Open the Card Gallery <ArrowRight className="h-2.5 w-2.5" />
              </Button>
              {hasImported === false && (
                <p className="text-label-secondary text-footnote pt-1 leading-relaxed">
                  Play NationStates?{" "}
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onNavigate?.("import")}
                    className="text-yellow h-auto px-0 align-baseline font-semibold"
                  >
                    Import your deck
                  </Button>{" "}
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
      />

      {/* 2. Achievements & rank */}
      <VaultMilestonesCard
        myAchievements={myAchievements}
        leaderboard={leaderboard}
        userCountryId={userCountryId}
      />
    </div>
  );
}
