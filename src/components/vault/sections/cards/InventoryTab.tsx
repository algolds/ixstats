"use client";

import { springSmooth } from "~/lib/design/motion";
import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckSquare,
  Folder,
  ShoppingBag,
  Trash as Trash2,
  WarningCircle as AlertCircle,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
  isSelected,
  selectMode,
  viewMode,
  hideValue,
  performanceMode,
  onClick,
}: {
  card: CardInstance;
  isSelected: boolean;
  selectMode: boolean;
  viewMode: ViewMode;
  hideValue: boolean;
  performanceMode: boolean;
  onClick: (card: CardInstance) => void;
}) {
  const handleToggle = useCallback(() => {
    onClick(card);
  }, [card, onClick]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springSmooth}
      className="relative"
    >
      {selectMode && (
        <div className="absolute top-2 left-2 z-20">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleToggle}
            className="size-6 border-2 border-white/70 bg-black/60"
          />
        </div>
      )}
      <CardDisplay
        card={card}
        size={viewMode === "compact" ? "small" : "medium"}
        onClick={onClick}
        hideValue={hideValue}
        performanceMode={performanceMode}
        className={cn(
          "transition-[color,background-color,border-color,box-shadow,opacity,transform]",
          selectMode && isSelected && "ring-tint ring-offset-surface ring-2 ring-offset-2"
        )}
      />
    </motion.div>
  );
});

export function InventoryTab({
  ownerships: _ownerships,
  isLoading,
  allCards,
  viewMode,
  selectMode,
  setSelectMode,
  hideValue,
  filters,
  onResetFilters,
}: {
  ownerships: CardInstance[];
  isLoading: boolean;
  allCards: CardInstance[];
  viewMode: ViewMode;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  hideValue: boolean;
  filters: FilterState;
  onResetFilters: () => void;
}) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  const utils = api.useUtils();
  const junkCardsMutation = api.cards.junkCards.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data.message || "Cards junked successfully!");
      setSelectedCards(new Set());
      setSelectMode(false);
      utils.cards.getMyCards.invalidate();
      utils.vault.getBalance.invalidate();
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

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

  const handleCardClick = useCallback(
    (card: CardInstance) => {
      const key = card.ownershipId || card.id;
      if (selectMode) {
        setSelectedCards((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(key)) newSet.delete(key);
          else newSet.add(key);
          return newSet;
        });
      } else {
        setSelectedCard(card);
      }
    },
    [selectMode]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Selection Action Bar */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springSmooth}
          >
            <Card className="border-tint/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="text-tint h-5 w-5" />
                  <span className="text-label text-headline">
                    {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""} selected
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allKeys = filteredCards.map((c) => c.ownershipId || c.id);
                      setSelectedCards(new Set(allKeys));
                    }}
                    className="text-footnote h-8"
                  >
                    Select All ({filteredCards.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCards(new Set())}
                    className="text-footnote h-8"
                  >
                    Deselect All
                  </Button>

                  <div className="bg-border/60 h-4 w-px" />

                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-label-secondary opacity-50"
                  >
                    <Folder className="mr-2 h-3.5 w-3.5" /> Move
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-label-secondary opacity-50"
                  >
                    <ShoppingBag className="mr-2 h-3.5 w-3.5" /> List Market
                  </Button>

                  <div className="border-separator flex items-center gap-2 border-l pl-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const ownershipIds = Array.from(selectedCards);
                        junkCardsMutation.mutate({ ownershipIds });
                      }}
                      disabled={junkCardsMutation.isPending || selectedCards.size === 0}
                      className="text-footnote text-red hover:bg-red/10 h-8"
                    >
                      {junkCardsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Junking...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Junk
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card grid */}
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="rounded-card h-80" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="text-label-tertiary mb-3 h-10 w-10" />
              <p className="text-label text-headline mb-1">No cards found</p>
              <p className="text-label-secondary text-footnote max-w-md text-center">
                {filters.search || filters.rarity !== "all" || filters.cardType !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "Import some NS cards or open a pack to get started!"}
              </p>
              {(filters.search || filters.rarity !== "all" || filters.cardType !== "all") && (
                <Button onClick={onResetFilters} className="mt-4" variant="outline">
                  Reset Filters
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
                  isSelected={selectedCards.has(key)}
                  selectMode={selectMode}
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
