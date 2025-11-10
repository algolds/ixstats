/**
 * CardDetailsModal Component
 * Expanded card view with full stats, market history, and actions
 * Phase 1: Card Display Components
 */

"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { X, TrendingUp, Users, Calendar, Star } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "~/components/ui/dialog";
import { RarityBadge } from "./RarityBadge";
import {
  formatCardStats,
  formatMarketValue,
  getCardTypeLabel,
  getOwnerCount,
  getRarityConfig,
} from "~/lib/card-display-utils";
import type { CardInstance } from "~/types/cards-display";

/**
 * CardDetailsModal component props
 */
export interface CardDetailsModalProps {
  /** Card instance to display */
  card: CardInstance | null;
  /** Modal open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Trade action handler */
  onTrade?: (card: CardInstance) => void;
  /** List on market handler */
  onList?: (card: CardInstance) => void;
  /** View collection handler */
  onViewCollection?: (countryId: string) => void;
}

/**
 * CardDetailsModal - Full card details with market data
 *
 * Features:
 * - Full card stats display
 * - Market history chart (placeholder)
 * - Ownership information
 * - Quick actions (Trade, List, View Collection)
 * - Glass modal depth level
 * - Responsive design
 *
 * @example
 * ```tsx
 * <CardDetailsModal
 *   card={selectedCard}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onTrade={handleTrade}
 * />
 * ```
 */
export const CardDetailsModal = React.memo<CardDetailsModalProps>(
  ({ card, open, onClose, onTrade, onList, onViewCollection }) => {
    // Memoize formatted stats
    const stats = useMemo(() => (card ? formatCardStats(card) : null), [card]);
    const rarityConfig = useMemo(
      () => (card ? getRarityConfig(card.rarity) : null),
      [card]
    );

    if (!card || !stats || !rarityConfig) return null;

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          className={cn(
            // Glass modal styling
            "glass-modal max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl p-0",
            // Responsive sizing
            "w-[98vw] sm:w-[95vw] max-h-[90vh] overflow-hidden"
          )}
        >
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-black/40 p-2 backdrop-blur-sm transition-colors hover:bg-black/60">
            <X className="h-5 w-5 text-white" />
          </DialogClose>

          <div className="grid h-full gap-6 overflow-auto p-3 sm:p-4 md:p-6 grid-cols-1 md:grid-cols-2">
            {/* Left column - Card artwork */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Card image */}
              <div className="relative aspect-[2.5/3.5] w-full overflow-hidden rounded-2xl border-2 shadow-2xl">
                <div
                  className={cn("absolute inset-0", rarityConfig.borderColor)}
                  style={{
                    borderWidth: "2px",
                    borderRadius: "1rem",
                  }}
                />
                <Image
                  src={card.artwork}
                  alt={card.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 90vw, 400px"
                />
                {/* Rarity glow */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl",
                    rarityConfig.glowColor,
                    rarityConfig.glowIntensity
                  )}
                />
              </div>

              {/* Market value & ownership */}
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <div className="glass-hierarchy-child rounded-lg p-2 sm:p-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70">
                    <TrendingUp className="h-4 w-4" />
                    Market Value
                  </div>
                  <div className={cn("mt-1 text-xl sm:text-2xl font-bold", rarityConfig.color)}>
                    {formatMarketValue(card.marketValue)}
                  </div>
                </div>

                <div className="glass-hierarchy-child rounded-lg p-2 sm:p-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70">
                    <Users className="h-4 w-4" />
                    Ownership
                  </div>
                  <div className="mt-1 text-base sm:text-lg font-semibold text-white">
                    {getOwnerCount(card.owners)}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right column - Card details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="space-y-4"
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-white">
                    {card.title}
                  </DialogTitle>
                  <RarityBadge rarity={card.rarity} size="medium" animated />
                </div>

                {/* Country & Type */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/70">
                  {card.country && (
                    <span className="flex items-center gap-1">
                      {card.country.flag && (
                        <span className="text-base">{card.country.flag}</span>
                      )}
                      {card.country.name}
                    </span>
                  )}
                  <span>•</span>
                  <span>{getCardTypeLabel(card.cardType)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Season {card.season}
                  </span>
                </div>

                {/* Description */}
                {card.description && (
                  <p className="text-xs sm:text-sm text-white/80">{card.description}</p>
                )}
              </div>

              {/* Stats grid */}
              <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold text-white">
                  <Star className="h-4 w-4" />
                  Card Statistics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {Object.entries(stats).map(([key, stat]) => (
                    <div key={key}>
                      <div className="text-[10px] sm:text-xs text-white/60">{stat.label}</div>
                      <div className="mt-1 flex items-baseline gap-1 sm:gap-2">
                        <span className={cn("text-xl sm:text-2xl font-bold", stat.color)}>
                          {stat.value}
                        </span>
                        <span className="text-[10px] sm:text-xs text-white/40">/100</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className={cn("h-full rounded-full", stat.color.replace("text-", "bg-"))}
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.value}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Market history placeholder */}
              <div className="glass-hierarchy-child rounded-lg p-3 sm:p-4">
                <h3 className="mb-3 text-xs sm:text-sm font-semibold text-white">
                  Market History
                </h3>
                <div className="flex h-32 items-center justify-center rounded-lg bg-white/5">
                  <p className="text-xs sm:text-sm text-white/40 text-center px-2">
                    Chart will be populated when trade data is available
                  </p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {onTrade && (
                  <button
                    onClick={() => onTrade(card)}
                    className={cn(
                      "glass-hierarchy-interactive rounded-lg px-3 sm:px-4 py-2 sm:py-3",
                      "text-xs sm:text-sm font-semibold text-white",
                      "transition-all hover:scale-105"
                    )}
                  >
                    Trade
                  </button>
                )}
                {onList && (
                  <button
                    onClick={() => onList(card)}
                    className={cn(
                      "glass-hierarchy-interactive rounded-lg px-3 sm:px-4 py-2 sm:py-3",
                      "text-xs sm:text-sm font-semibold text-white",
                      "transition-all hover:scale-105"
                    )}
                  >
                    List
                  </button>
                )}
                {onViewCollection && card.countryId && (
                  <button
                    onClick={() => onViewCollection(card.countryId!)}
                    className={cn(
                      "glass-hierarchy-interactive rounded-lg px-3 sm:px-4 py-2 sm:py-3",
                      "text-xs sm:text-sm font-semibold text-white",
                      "transition-all hover:scale-105"
                    )}
                  >
                    View Collection
                  </button>
                )}
              </div>

              {/* Additional metadata */}
              {card.level > 1 && (
                <div className="glass-hierarchy-child rounded-lg p-2 sm:p-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-white/70">Enhancement Level</span>
                    <span className="font-bold text-amber-400">
                      Level {card.level}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

CardDetailsModal.displayName = "CardDetailsModal";
