/**
 * RarityBadge Component
 * Animated rarity indicator for trading cards
 * Phase 1: Card Display Components
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { getRarityConfig, getShimmerEffect, CARD_RARITIES } from "~/lib/card-display-utils";
import type { CardRarity } from "~/lib/card-enums";

/**
 * RarityBadge component props
 */
export interface RarityBadgeProps {
  /** Card rarity tier */
  rarity: string;
  /** Badge size variant */
  size?: "small" | "medium" | "large";
  /** Enable shimmer animation for rare+ cards */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * RarityBadge - Displays card rarity with color-coded styling
 *
 * Features:
 * - Color-coded by rarity tier (gray → gold gradient)
 * - Shimmer effect for rare+ cards
 * - Pulse animation on hover
 * - GPU-accelerated animations
 *
 * @example
 * ```tsx
 * <RarityBadge rarity={CardRarity.LEGENDARY} size="medium" animated />
 * ```
 */
export const RarityBadge = React.memo<RarityBadgeProps>(
  ({ rarity, size = "medium", animated = true, className }) => {
    const config = getRarityConfig(rarity);
    const shimmer = getShimmerEffect(rarity as CardRarity, animated);

    // Size-specific classes
    const sizeClasses = {
      small: "px-2 py-0.5 text-xs",
      medium: "px-3 py-1 text-sm",
      large: "px-4 py-1.5 text-base",
    };

    return (
      <motion.div
        className={cn(
          // Base styles
          "inline-flex items-center justify-center",
          "rounded-full font-semibold",
          "border backdrop-blur-sm",
          // Glass effect
          "bg-black/20",
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
          animated && rarity === CARD_RARITIES.LEGENDARY
            ? {
                // Static glow for legendary - no pulsing
                boxShadow: "0 0 15px rgba(251, 191, 36, 0.6)",
              }
            : undefined
        }
      >
        {/* Rarity label */}
        <span className="relative z-10">{config.label}</span>

        {/* Static shimmer gradient for legendary - no animation */}
        {animated && rarity === CARD_RARITIES.LEGENDARY && (
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background:
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
