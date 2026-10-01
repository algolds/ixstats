"use client";

import React from "react";
import { Component as Layers, ArrowRight, Download } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
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
  // oxlint-disable-next-line eslint/no-unused-vars
  getRarityGlow,
  // oxlint-disable-next-line eslint/no-unused-vars
  getRarityBorder,
}: VaultCardHoldingsCardProps) {
  return (
    // v2 (c5c6b382): a glass showcase card with the dot texture.
    <FacetCard
      variant="glass"
      padding="lg"
      texture="dots"
      textureOpacity={0.04}
      className="overflow-hidden"
    >
      <div className="border-separator mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-row bg-tint-fill text-tint shadow-card flex h-8 w-8 items-center justify-center border font-medium">
            <Layers className="text-tint h-4.5 w-4.5" />
          </div>
          <span className="text-label-secondary text-eyebrow">Card Holdings</span>
        </div>
        {featuredCards.length > 0 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => onNavigate?.("cards")}
            className="text-footnote text-yellow h-auto gap-1 px-0 font-semibold"
          >
            Manage Portfolio <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {topCardsLoading ? (
        <div className="flex justify-center py-8">
          <Skeleton className="bg-fill-3 rounded-card h-64 w-44" />
        </div>
      ) : featuredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Layers className="text-label-tertiary mb-3 h-10 w-10" />
          <span className="text-label text-footnote block font-semibold">Portfolio Empty</span>
          <p className="text-label-secondary text-footnote mt-1 mb-3">
            Import cards or open packs to populate your assets.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate?.("import")}
            className="border-yellow/30 bg-yellow/10 text-footnote text-yellow hover:bg-yellow/20 h-8 rounded-full font-semibold active:scale-95"
          >
            <Download className="mr-2 h-3.5 w-3.5" /> NS Import
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
            <div className="border-separator space-y-2 border-t pt-3">
              {featuredCards.slice(1, 3).map((card) => (
                <div
                  key={card.id}
                  className="border-separator bg-fill-4 hover:bg-fill-3 rounded-row text-footnote flex cursor-pointer items-center justify-between border px-3 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.985]"
                >
                  <span className="text-label max-w-[130px] truncate font-semibold">
                    {card.title}
                  </span>
                  <span className="text-footnote text-yellow font-data flex items-center gap-0.5 font-semibold tabular-nums">
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
