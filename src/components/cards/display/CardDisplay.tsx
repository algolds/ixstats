/**
 * CardDisplay Component
 * Individual trading card with 3D effects and holographic parallax
 * Phase 1: Card Display Components
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { CometCard } from "~/components/ui/comet-card";
import { RarityBadge } from "./RarityBadge";
import {
  getRarityGlow,
  getRarityConfig,
  getCardWidth,
  getCardAspectRatio,
  formatCardStats,
  formatMarketValue,
  getCardTypeLabel,
} from "~/lib/card-display-utils";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

/**
 * CardDisplay component props
 */
export interface CardDisplayProps {
  /** Card instance data */
  card: CardInstance;
  /** Display size variant */
  size?: CardDisplaySize;
  /** Click handler */
  onClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show stats on hover (default: true) */
  showStatsOnHover?: boolean;
  /** Enable 3D tilt effect (default: true) */
  enable3D?: boolean;
}

/**
 * CardDisplay - Premium trading card component with glass physics
 *
 * Features:
 * - Holographic parallax with CometCard
 * - Rarity-based glow colors
 * - Hover state with stats reveal
 * - 3 size variants (small, medium, large)
 * - Glass physics depth hierarchy (child/interactive levels)
 * - GPU-accelerated animations
 * - Lazy-loaded images
 *
 * @example
 * ```tsx
 * <CardDisplay
 *   card={cardInstance}
 *   size="medium"
 *   onClick={(card) => console.log('Clicked:', card.title)}
 * />
 * ```
 */
export const CardDisplay = React.memo<CardDisplayProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    showStatsOnHover = true,
    enable3D = true,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const rarityConfig = getRarityConfig(card.rarity);
    const stats = formatCardStats(card);

    // Size-dependent classes
    const widthClass = getCardWidth(size);
    const aspectRatioClass = getCardAspectRatio(size);

    // Font sizes based on card size
    const fontSizes = {
      small: {
        title: "text-xs",
        type: "text-[10px]",
        stats: "text-[10px]",
      },
      medium: {
        title: "text-sm",
        type: "text-xs",
        stats: "text-xs",
      },
      large: {
        title: "text-base",
        type: "text-sm",
        stats: "text-sm",
      },
    };

    const fonts = fontSizes[size];

    /**
     * Handle card click
     */
    const handleClick = () => {
      if (onClick) {
        onClick(card);
      }
    };

    return (
      <CometCard
        className={cn(
          // Base sizing
          widthClass,
          aspectRatioClass,
          // Glass physics - child level
          "glass-hierarchy-child",
          // Interactive cursor
          onClick && "cursor-pointer",
          // Smooth transitions
          "transition-all duration-300",
          // Custom classes
          className
        )}
        rotateDepth={enable3D ? 12 : 0}
        translateDepth={enable3D ? 15 : 0}
      >
        <motion.div
          className={cn(
            "relative h-full w-full overflow-hidden rounded-2xl",
            "border-2",
            rarityConfig.borderColor
          )}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={handleClick}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          {/* Card artwork */}
          <div className="relative h-full w-full">
            <Image
              src={card.artwork}
              alt={card.title}
              fill
              className="object-cover"
              loading="lazy"
              sizes={
                size === "small"
                  ? "128px"
                  : size === "medium"
                  ? "192px"
                  : "256px"
              }
            />

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Rarity glow effect */}
            <motion.div
              className={cn(
                "absolute inset-0 rounded-2xl",
                getRarityGlow(card.rarity)
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 0.3 : 0 }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Card content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-3">
            {/* Top section - Rarity badge & type */}
            <div className="flex items-start justify-between">
              <RarityBadge
                rarity={card.rarity}
                size={size === "large" ? "medium" : "small"}
                animated
              />
              {card.cardType && (
                <span
                  className={cn(
                    "rounded-md bg-black/40 px-2 py-0.5 font-medium backdrop-blur-sm",
                    fonts.type,
                    "text-white/80"
                  )}
                >
                  {getCardTypeLabel(card.cardType)}
                </span>
              )}
            </div>

            {/* Bottom section - Card info */}
            <div className="space-y-1">
              {/* Card title */}
              <h3
                className={cn(
                  "font-bold text-white line-clamp-2",
                  fonts.title
                )}
              >
                {card.title}
              </h3>

              {/* Country name (if available) */}
              {card.country && (
                <p className={cn("text-white/70", fonts.type)}>
                  {card.country.name}
                </p>
              )}

              {/* Season & Market value */}
              <div className={cn("flex items-center justify-between", fonts.type)}>
                <span className="text-white/60">Season {card.season}</span>
                <span className={cn("font-semibold", rarityConfig.color)}>
                  {formatMarketValue(card.marketValue)}
                </span>
              </div>

              {/* Stats reveal on hover */}
              <AnimatePresence>
                {showStatsOnHover && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "grid grid-cols-1 xs:grid-cols-2 gap-1 rounded-lg bg-black/60 p-2 backdrop-blur-md",
                      fonts.stats
                    )}
                  >
                    {Object.entries(stats).map(([key, stat]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-white/70">{stat.label}</span>
                        <span className={cn("font-bold", stat.color)}>
                          {stat.value}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Level indicator (if enhanced) */}
          {card.level > 1 && (
            <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black">
              {card.level}
            </div>
          )}
        </motion.div>
      </CometCard>
    );
  }
);

CardDisplay.displayName = "CardDisplay";
