// src/components/cards/pack-opening/Stage4_QuickActions.tsx
// Stage 4: Post-reveal quick actions for cards

"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardInstance, QuickActionType, QuickActionEvent } from "~/types/pack-opening";
import { getPackOpeningService } from "~/lib/pack-opening-service";

interface Stage4_QuickActionsProps {
  cards: CardInstance[];
  onAction: (event: QuickActionEvent) => void;
  onComplete: () => void;
}

/**
 * Stage4_QuickActions - Post-reveal action interface
 *
 * Features:
 * - Junk/Keep/List buttons per card
 * - Bulk selection mode
 * - Quick sell estimates
 * - Auto-collect option
 * - User-controlled progression
 */
export const Stage4_QuickActions = React.memo<Stage4_QuickActionsProps>(
  ({ cards, onAction, onComplete }) => {
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    const [bulkMode, setBulkMode] = useState(false);
    const [cardActions, setCardActions] = useState<Map<string, QuickActionType>>(
      new Map()
    );
    const service = getPackOpeningService();

    // Calculate estimated value
    const estimatedValue = useMemo(() => {
      // Rarity value multipliers (placeholder)
      const rarityValues: Record<string, number> = {
        COMMON: 10,
        UNCOMMON: 25,
        RARE: 75,
        ULTRA_RARE: 200,
        EPIC: 500,
        LEGENDARY: 1500,
      };

      return cards.reduce((total, card) => {
        return total + (rarityValues[card.rarity] ?? 10);
      }, 0);
    }, [cards]);

    // Handle individual card action
    const handleCardAction = (cardId: string, action: QuickActionType) => {
      setCardActions((prev) => new Map(prev).set(cardId, action));
      onAction({ cardId, action });
      service.triggerHaptic("light");
    };

    // Handle bulk selection toggle
    const toggleBulkSelection = (cardId: string) => {
      setSelectedCards((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else {
          next.add(cardId);
        }
        return next;
      });
    };

    // Handle bulk action
    const handleBulkAction = (action: QuickActionType) => {
      selectedCards.forEach((cardId) => {
        handleCardAction(cardId, action);
      });
      setSelectedCards(new Set());
      setBulkMode(false);
      service.triggerHaptic("medium");
    };

    // Auto-collect all
    const handleCollectAll = () => {
      cards.forEach((card) => {
        if (!cardActions.has(card.id)) {
          handleCardAction(card.id, "collect");
        }
      });
      service.triggerHaptic("medium");

      // Complete after short delay
      setTimeout(() => {
        onComplete();
      }, 500);
    };

    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        {/* Header with stats */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="border-b border-white/10 bg-black/20 p-6 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Cards Received
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {cards.length} card{cards.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="text-right">
              <div className="text-sm text-white/60">Estimated Value</div>
              <div className="text-2xl font-bold text-yellow-400">
                {estimatedValue.toLocaleString()} IC
              </div>
            </div>
          </div>

          {/* Bulk mode toggle */}
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              {bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
            </button>

            {bulkMode && selectedCards.size > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex gap-2"
              >
                <button
                  onClick={() => handleBulkAction("junk")}
                  className="rounded-lg bg-red-500/20 px-3 py-1 text-sm font-medium text-red-300 hover:bg-red-500/30"
                >
                  Junk ({selectedCards.size})
                </button>
                <button
                  onClick={() => handleBulkAction("keep")}
                  className="rounded-lg bg-green-500/20 px-3 py-1 text-sm font-medium text-green-300 hover:bg-green-500/30"
                >
                  Keep ({selectedCards.size})
                </button>
                <button
                  onClick={() => handleBulkAction("list")}
                  className="rounded-lg bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-300 hover:bg-blue-500/30"
                >
                  List ({selectedCards.size})
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Cards grid with action buttons */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <AnimatePresence mode="sync">
              {cards.map((card, index) => (
                <CardActionItem
                  key={card.id}
                  card={card}
                  index={index}
                  isSelected={selectedCards.has(card.id)}
                  bulkMode={bulkMode}
                  action={cardActions.get(card.id)}
                  onToggleSelect={toggleBulkSelection}
                  onAction={handleCardAction}
                  service={service}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer actions */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="border-t border-white/10 bg-black/20 p-6 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/60">
              {cardActions.size} of {cards.length} cards processed
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCollectAll}
                className="rounded-lg bg-green-500/20 px-6 py-3 font-medium text-green-300 transition-colors hover:bg-green-500/30"
              >
                Collect All
              </button>
              <button
                onClick={onComplete}
                className="rounded-lg bg-blue-500/20 px-6 py-3 font-medium text-blue-300 transition-colors hover:bg-blue-500/30"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
);

Stage4_QuickActions.displayName = "Stage4_QuickActions";

/**
 * Individual card action item
 */
interface CardActionItemProps {
  card: CardInstance;
  index: number;
  isSelected: boolean;
  bulkMode: boolean;
  action?: QuickActionType;
  onToggleSelect: (cardId: string) => void;
  onAction: (cardId: string, action: QuickActionType) => void;
  service: ReturnType<typeof getPackOpeningService>;
}

const CardActionItem = React.memo<CardActionItemProps>(
  ({ card, index, isSelected, bulkMode, action, onToggleSelect, onAction, service }) => {
    const rarityColor = service.getRarityColor(card.rarity);

    // Rarity value estimates
    const rarityValues: Record<string, number> = {
      COMMON: 10,
      UNCOMMON: 25,
      RARE: 75,
      ULTRA_RARE: 200,
      EPIC: 500,
      LEGENDARY: 1500,
    };
    const estimatedValue = rarityValues[card.rarity] ?? 10;

    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: index * 0.05,
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
        className={`relative rounded-xl transition-all ${
          isSelected ? "ring-2 ring-blue-400" : ""
        } ${action ? "opacity-50" : ""}`}
      >
        {/* Card preview */}
        <div
          className="group relative cursor-pointer overflow-hidden rounded-xl"
          onClick={() => bulkMode && onToggleSelect(card.id)}
        >
          {/* Rarity glow */}
          <div
            className="absolute -inset-1 rounded-xl opacity-50 blur-lg"
            style={{
              backgroundColor: rarityColor,
            }}
          />

          {/* Card image */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-br from-white/10 to-white/5">
            <div
              className="h-full w-full bg-cover bg-center transition-transform group-hover:scale-110"
              style={{
                backgroundImage: `url(${card.artwork})`,
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Card info */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                  {card.rarity.replace("_", " ")}
                </div>
                <div className="mt-1 text-sm font-bold text-white">
                  {card.name || card.title || "Unknown"}
                </div>
              </div>

              {/* Rarity badge */}
              <div
                className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: `${rarityColor}80`,
                  color: "white",
                }}
              >
                {card.rarity.charAt(0)}
              </div>

              {/* Bulk select indicator */}
              {bulkMode && (
                <div
                  className={`absolute left-2 top-2 h-6 w-6 rounded-full border-2 transition-colors ${
                    isSelected
                      ? "border-blue-400 bg-blue-400"
                      : "border-white/40 bg-transparent"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="h-full w-full text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              )}

              {/* Action indicator */}
              {action && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold uppercase text-white backdrop-blur-sm">
                    {action}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons (only show if not in bulk mode) */}
        {!bulkMode && !action && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 + 0.3 }}
            className="mt-2 flex gap-1"
          >
            <button
              onClick={() => onAction(card.id, "junk")}
              className="flex-1 rounded bg-red-500/20 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30"
              title="Junk for credits"
            >
              Junk
            </button>
            <button
              onClick={() => onAction(card.id, "keep")}
              className="flex-1 rounded bg-green-500/20 py-1 text-xs font-medium text-green-300 hover:bg-green-500/30"
              title="Keep in collection"
            >
              Keep
            </button>
            <button
              onClick={() => onAction(card.id, "list")}
              className="flex-1 rounded bg-blue-500/20 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/30"
              title="List on marketplace"
            >
              List
            </button>
          </motion.div>
        )}

        {/* Estimated value */}
        <div className="mt-1 text-center text-xs text-white/50">
          ~{estimatedValue} IC
        </div>
      </motion.div>
    );
  }
);

CardActionItem.displayName = "CardActionItem";
