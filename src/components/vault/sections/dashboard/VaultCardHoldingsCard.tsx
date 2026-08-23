"use client";

import React from "react";
import { motion } from "motion/react";
import { Component as Layers, ArrowRight, Download } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { FacetCard } from "~/components/ui/facet-container";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import type { CardInstance } from "~/types/cards-display";

export interface VaultCardHoldingsCardProps {
  featuredCards: CardInstance[];
  topCardsLoading: boolean;
  onNavigate?: (section: string) => void;
  getRarityGlow: (rarity?: string | null) => string;
  getRarityBorder: (rarity?: string | null) => string;
}

export function VaultCardHoldingsCard({
  featuredCards,
  topCardsLoading,
  onNavigate,
  getRarityGlow,
  getRarityBorder,
}: VaultCardHoldingsCardProps) {
  return (
    <FacetCard
      depth={2}
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-purple-500/30 hover:shadow-purple-500/10"
      )}
    >
      <TextureOverlay texture="dots" opacity={0.04} />

      <div className="border-border/40 relative z-10 mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-600 shadow-sm backdrop-blur-md dark:text-purple-400">
            <Layers className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Card Holdings
          </span>
        </div>
        {featuredCards.length > 0 && (
          <button
            onClick={() => onNavigate?.("cards")}
            className="flex items-center gap-1 text-[11px] font-bold text-purple-600 transition-transform hover:underline active:scale-95 dark:text-purple-400"
          >
            Manage Portfolio <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {topCardsLoading ? (
        <div className="flex justify-center py-8">
          <Skeleton className="bg-muted/40 h-64 w-44 rounded-2xl" />
        </div>
      ) : featuredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Layers className="text-muted-foreground/40 mb-3 h-10 w-10" />
          <span className="text-foreground block text-xs font-bold">Portfolio Empty</span>
          <p className="text-muted-foreground mt-1 mb-3 text-[11px]">
            Import cards or open packs to populate your assets.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate?.("import")}
            className="h-8 rounded-full border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-600 hover:bg-rose-500/20 active:scale-95 dark:text-rose-400"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> NS Import
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 3D Featured Assets Display */}
          <div className="flex justify-center py-2">
            <CardDisplay
              card={featuredCards[0]}
              size="medium"
              performanceMode={false}
              enable3D={true}
              enableHolographic={true}
            />
          </div>

          {/* Other assets list */}
          {featuredCards.length > 1 && (
            <div className="border-border/40 space-y-2 border-t pt-3">
              {featuredCards.slice(1, 3).map((card) => (
                <div
                  key={card.id}
                  className="border-border/40 bg-muted/30 hover:bg-muted/60 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs backdrop-blur-md transition-all active:scale-[0.985] dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <span className="text-foreground max-w-[130px] truncate font-semibold">
                    {card.title}
                  </span>
                  <span className="flex items-center gap-0.5 font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400">
                    <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                    {card.marketValue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </FacetCard>
  );
}
