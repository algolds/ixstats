"use client";
/**
 * RarityBadge Component
 * Animated rarity indicator for trading cards
 * Phase 1: Card Display Components
 */

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { getRarityConfig, getShimmerEffect, CARD_RARITIES } from "~/lib/cards/display-utils";
import type { CardRarity } from "~/lib/cards/enums";

/**
 * RarityBadge component props
 */
export interface RarityBadgeProps {
  /** Card rarity tier */
  rarity: string;
  /** Season number */
  season?: number;
  /** Badge size variant */
  size?: "small" | "medium" | "large";
  /** Enable shimmer animation for rare+ cards */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * RarityBadge - Displays card rarity and season with color-coded styling
 *
 * Features:
 * - Color-coded by rarity tier (gray → gold gradient)
 * - Shimmer effect for rare+ cards
 * - Pulse animation on hover
 * - GPU-accelerated animations
 *
 * @example
 * ```tsx
 * <RarityBadge rarity={CardRarity.LEGENDARY} season={1} size="medium" animated />
 * ```
 */
export const RarityBadge = React.memo<RarityBadgeProps>(
  ({ rarity, season, size = "medium", animated = true, className }) => {
    const config = getRarityConfig(rarity);
    const shimmer = getShimmerEffect(rarity as CardRarity, animated);

    // Size-specific classes
    const sizeClasses = {
      small: "px-2 py-0.5 text-[10px] gap-1",
      medium: "px-2.5 py-1 text-xs gap-1.5",
      large: "px-3.5 py-1.5 text-sm gap-2",
    };

    return (
      <motion.div
        className={cn(
          // Base styles
          "inline-flex items-center justify-center font-bold tracking-wide",
          "rounded-full border shadow-xs backdrop-blur-md",
          // Glass background
          "bg-background/80 dark:bg-black/50",
          // Rarity-specific styles
          config.color,
          config.borderColor,
          // Size
          sizeClasses[size],
          // Shimmer effect
          shimmer,
          // Custom classes
          className
        )}
        initial={{ scale: 1 }}
        whileHover={{
          scale: animated ? 1.05 : 1,
          transition: { duration: 0.2 },
        }}
        animate={
          animated &&
          (rarity === CARD_RARITIES.LEGENDARY ||
            rarity === CARD_RARITIES.MYTHIC ||
            rarity === CARD_RARITIES.DIVINE)
            ? {
                boxShadow:
                  rarity === CARD_RARITIES.DIVINE
                    ? "0 0 20px rgba(253, 224, 71, 0.6)"
                    : rarity === CARD_RARITIES.MYTHIC
                      ? "0 0 15px rgba(244, 63, 94, 0.5)"
                      : "0 0 15px rgba(251, 191, 36, 0.4)",
              }
            : undefined
        }
      >
        {/* Rarity Diamond Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="none"
          className={cn(
            "shrink-0 fill-current",
            size === "small" ? "h-2.5 w-2.5" : size === "medium" ? "h-3 w-3" : "h-3.5 w-3.5"
          )}
        >
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
        </svg>

        {/* Label or Season */}
        {season !== undefined ? (
          <span className="text-foreground relative z-10 leading-none font-bold tracking-wide">
            S{season}
          </span>
        ) : (
          <span className="relative z-10 leading-none">{config.label}</span>
        )}

        {/* Static shimmer gradient for legendary */}
        {animated && rarity === CARD_RARITIES.LEGENDARY && (
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent)",
              backgroundSize: "200% 200%",
              backgroundPosition: "50% 50%",
            }}
          />
        )}
      </motion.div>
    );
  }
);

RarityBadge.displayName = "RarityBadge";
