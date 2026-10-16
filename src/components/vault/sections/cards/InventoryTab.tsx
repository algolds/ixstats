"use client";

import { springSmooth } from "~/lib/design/motion";
import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { WarningCircle as AlertCircle } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import type { CardInstance } from "~/types/cards-display";
import type { FilterState, ViewMode } from "./types";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then((m) => m.CardDetailsModal),
  { ssr: false }
);

const InventoryCardItem = React.memo(function InventoryCardItem({
  card,
  viewMode,
  hideValue,
  performanceMode,
  onClick,
}: {
  card: CardInstance;
  viewMode: ViewMode;
  hideValue: boolean;
  performanceMode: boolean;
  onClick: (card: CardInstance) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springSmooth}
      className="relative"
    >
      <CardDisplay
        card={card}
        size={viewMode === "compact" ? "small" : "medium"}
        onClick={onClick}
        hideValue={hideValue}
        performanceMode={performanceMode}
        className="transition-[color,background-color,border-color,box-shadow,opacity,transform]"
      />
    </motion.div>
  );
});

export function InventoryTab({
  isLoading,
  allCards,
  viewMode,
  hideValue,
  filters,
  onResetFilters,
}: {
  isLoading: boolean;
  allCards: CardInstance[];
  viewMode: ViewMode;
  hideValue: boolean;
  filters: FilterState;
  onResetFilters: () => void;
}) {
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(searchLower);
        const matchesCountry = card.country?.name.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesCountry) return false;
      }
      if (filters.cardType !== "all" && card.cardType !== filters.cardType) return false;
      if (filters.season !== "all" && card.season !== filters.season) return false;
      if (card.level < filters.minLevel || card.level > filters.maxLevel) return false;
      if (card.marketValue < filters.minValue || card.marketValue > filters.maxValue) return false;
      return true;
    });
  }, [allCards, filters]);

  const totalCards = allCards.length;
  const isLargeGrid = filteredCards.length > 250;

  const handleCardClick = useCallback((card: CardInstance) => setSelectedCard(card), []);

  return (
    <div className="flex flex-col gap-6">
      {/* Card grid */}
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="rounded-card h-80" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <Card className="flex flex-col gap-6 py-6">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="text-label-tertiary mb-3 h-10 w-10" />
              <p className="text-label text-headline mb-1">No cards found</p>
              <p className="text-label-secondary text-footnote max-w-md text-center">
                {filters.search || filters.rarity !== "all" || filters.cardType !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "Import NS cards or open a pack to add cards."}
              </p>
              {(filters.search || filters.rarity !== "all" || filters.cardType !== "all") && (
                <Button onClick={onResetFilters} className="mt-4" variant="outline">
                  Reset filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              "grid gap-4",
              viewMode === "grid" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
              viewMode === "list" && "grid-cols-1",
              viewMode === "compact" &&
                "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            )}
          >
            {filteredCards.map((card) => {
              const key = card.ownershipId || card.id;
              return (
                <InventoryCardItem
                  key={key}
                  card={card}
                  viewMode={viewMode}
                  hideValue={hideValue}
                  performanceMode={isLargeGrid}
                  onClick={handleCardClick}
                />
              );
            })}
          </div>
        )}
        {!isLoading && filteredCards.length > 0 && (
          <div className="text-label-secondary text-body mt-6 text-center">
            Showing {filteredCards.length} of {totalCards} cards
          </div>
        )}
      </div>

      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}
