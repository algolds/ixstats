"use client";

// src/components/cards/pack-opening/Stage4_QuickActions.tsx
// Stage 4: Post-reveal quick actions for cards

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { CardInstance, QuickActionType, QuickActionEvent } from "~/types/pack-opening";
import { getPackOpeningService } from "~/lib/cards/pack-opening-service";
import { CardHolographicCover } from "../display/CardHolographicCover";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { Button } from "~/components/ui/button";

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
    const [cardActions, setCardActions] = useState<Map<string, QuickActionType>>(new Map());
    const service = getPackOpeningService();

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
      const cardIdList = Array.from(selectedCards);

      // Update local state for all selected cards
      setCardActions((prev) => {
        const next = new Map(prev);
        cardIdList.forEach((id) => next.set(id, action));
        return next;
      });

      // Call onAction once with all cardIds
      onAction({ cardIds: cardIdList, action });

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
          className="border-separator bg-surface-secondary border-b p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title-1 text-label">Cards received</h2>
              <p className="text-body text-label-secondary mt-1">
                {cards.length} card{cards.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Bulk mode toggle */}
          <div className="mt-4 flex items-center gap-4">
            <Button
              variant="secondary"
              aria-pressed={bulkMode}
              onClick={() => setBulkMode(!bulkMode)}
            >
              {bulkMode ? "Exit Bulk Mode" : "Bulk Select"}
            </Button>

            {bulkMode && selectedCards.size > 0 && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1 }}
                className="flex gap-2"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleBulkAction("junk")}
                  className="bg-red/15 text-red hover:bg-red/25"
                >
                  Junk ({selectedCards.size})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleBulkAction("keep")}
                  className="bg-green/15 text-green hover:bg-green/25"
                >
                  Keep ({selectedCards.size})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleBulkAction("list")}
                  className="bg-blue/15 text-blue hover:bg-blue/25"
                >
                  List ({selectedCards.size})
                </Button>
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
          className="border-separator bg-surface-secondary border-t p-6"
        >
          <div className="flex items-center justify-between">
            <div className="text-body text-label-secondary">
              {cardActions.size} of {cards.length} cards processed
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleCollectAll}
                className="bg-green/15 text-green hover:bg-green/25"
              >
                Collect all
              </Button>
              <Button size="lg" onClick={onComplete}>
                Done
              </Button>
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

    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: index * 0.05,
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
        className={`rounded-row relative transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
          isSelected ? "ring-blue ring-2" : ""
        } ${action ? "opacity-50" : ""}`}
      >
        {/* Card preview */}
        <div
          className="group rounded-row relative cursor-pointer overflow-hidden"
          onClick={() => bulkMode && onToggleSelect(card.id)}
        >
          {/* Rarity glow */}
          <div
            className="rounded-row absolute -inset-1 opacity-50 blur-lg"
            style={{
              backgroundColor: rarityColor,
            }}
          />

          {/* Card image */}
          <div className="rounded-row card-art-linear-br relative aspect-[3/4] overflow-hidden from-white/10 to-white/5">
            <CardHolographicCover cardType={card.cardType} rarity={card.rarity} />
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform"
              style={{
                backgroundImage: `url(${proxyCardArtwork(card.artwork)})`,
              }}
            >
              {/* Gradient overlay */}
              <div className="card-art-linear-t absolute inset-0 from-black/80 via-transparent to-transparent" />

              {/* Card info */}
              <div className="absolute right-0 bottom-0 left-0 p-3">
                <div className="text-footnote text-label-secondary">
                  {card.rarity.replace("_", " ")}
                </div>
                <div className="text-headline text-label mt-1">
                  {card.name || card.title || "Unknown"}
                </div>
              </div>

              {/* Rarity badge */}
              <div
                className="text-footnote absolute top-2 right-2 rounded-full px-2 py-0.5 font-semibold"
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
                  className={`absolute top-2 left-2 h-6 w-6 rounded-full border-2 transition-colors ${
                    isSelected ? "border-blue bg-blue" : "border-separator bg-transparent"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="text-label h-full w-full"
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
                  <div className="rounded-control bg-fill-3 text-headline text-label px-4 py-2">
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAction(card.id, "junk")}
              title="Junk for credits"
              className="bg-red/15 text-red hover:bg-red/25 flex-1"
            >
              Junk
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAction(card.id, "keep")}
              title="Keep in collection"
              className="bg-green/15 text-green hover:bg-green/25 flex-1"
            >
              Keep
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAction(card.id, "list")}
              title="List on marketplace"
              className="bg-blue/15 text-blue hover:bg-blue/25 flex-1"
            >
              List
            </Button>
          </motion.div>
        )}
      </motion.div>
    );
  }
);

CardActionItem.displayName = "CardActionItem";
