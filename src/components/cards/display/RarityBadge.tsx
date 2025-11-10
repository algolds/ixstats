/**
 * RarityBadge Component
 * Animated rarity indicator for trading cards
 * Phase 1: Card Display Components
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import { CardRarity } from "@prisma/client";
import { cn } from "~/lib/utils";
import { getRarityConfig, getShimmerEffect } from "~/lib/card-display-utils";

/**
 * RarityBadge component props
 */
export interface RarityBadgeProps {
  /** Card rarity tier */
  rarity: CardRarity;
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
    const shimmer = getShimmerEffect(rarity, animated);

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
          animated && rarity === CardRarity.LEGENDARY
            ? {
                // Rainbow pulse for legendary
                boxShadow: [
                  "0 0 10px rgba(251, 191, 36, 0.5)",
                  "0 0 20px rgba(168, 85, 247, 0.5)",
                  "0 0 10px rgba(251, 191, 36, 0.5)",
                ],
              }
            : undefined
        }
        transition={
          animated && rarity === CardRarity.LEGENDARY
            ? {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      >
        {/* Rarity label */}
        <span className="relative z-10">{config.label}</span>

        {/* Background shimmer gradient for legendary */}
        {animated && rarity === CardRarity.LEGENDARY && (
          <motion.div
            className="absolute inset-0 rounded-full opacity-50"
            style={{
              background:
                "linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent)",
              backgroundSize: "200% 200%",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </motion.div>
    );
  }
);

RarityBadge.displayName = "RarityBadge";
