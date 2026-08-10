"use client";

import React, { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckSquare,
  Folder,
  ShoppingBag,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { vaultNotify } from "~/lib/vault-notifications";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Skeleton } from "~/components/ui/skeleton";
import { CardDisplay } from "~/components/cards/display";
import type { CardInstance } from "~/types/cards-display";
import type { FilterState, ViewMode } from "./types";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then((m) => m.CardDetailsModal),
  { ssr: false }
);

export function InventoryTab({
  ownerships,
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
    <div className="space-y-4">
      {/* Bulk Actions */}
      <AnimatePresence>
        {selectMode && selectedCards.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4"
          >
            <Card className="glass-hierarchy-interactive rounded-2xl border-amber-400/30 bg-black/85 shadow-2xl shadow-black/80 backdrop-blur-xl">
              <CardContent className="p-3.5">
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <span className="text-foreground text-sm font-bold">
                      {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        vaultNotify.cardsBulkAction("Added to collection:", selectedCards.size);
                        setSelectedCards(new Set());
                        setSelectMode(false);
                      }}
                      className="h-8 text-xs"
                    >
                      <Folder className="mr-1.5 h-3.5 w-3.5" /> Collection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        vaultNotify.cardsBulkAction("Listed for auction:", selectedCards.size);
                        setSelectedCards(new Set());
                        setSelectMode(false);
                      }}
                      className="h-8 text-xs"
                    >
                      <ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Sell
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const ownershipIds = Array.from(selectedCards);
                        junkCardsMutation.mutate({ ownershipIds });
                      }}
                      disabled={junkCardsMutation.isPending}
                      className="h-8 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      {junkCardsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Junking...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Junk
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCards(new Set());
                        setSelectMode(false);
                      }}
                      className="h-8 text-xs"
                    >
                      Cancel
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
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="text-muted-foreground/40 mb-3 h-10 w-10" />
              <p className="text-foreground/80 mb-1 text-sm font-bold">No cards found</p>
              <p className="text-muted-foreground max-w-md text-center text-xs">
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
            {filteredCards.map((card) => (
              <motion.div
                key={card.ownershipId || card.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {selectMode && (
                  <div className="absolute top-2 left-2 z-20">
                    <Checkbox
                      checked={selectedCards.has(card.ownershipId || card.id)}
                      onCheckedChange={() => handleCardClick(card)}
                      className="h-6 w-6 border-2 border-white bg-black/60 backdrop-blur-sm"
                    />
                  </div>
                )}
                <CardDisplay
                  card={card}
                  size={viewMode === "compact" ? "small" : "medium"}
                  onClick={handleCardClick}
                  hideValue={hideValue}
                  className={cn(
                    "transition-all",
                    selectMode &&
                      selectedCards.has(card.ownershipId || card.id) &&
                      "ring-2 ring-amber-400 ring-offset-2 ring-offset-black"
                  )}
                />
              </motion.div>
            ))}
          </div>
        )}
        {!isLoading && filteredCards.length > 0 && (
          <div className="text-muted-foreground mt-6 text-center text-sm">
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
