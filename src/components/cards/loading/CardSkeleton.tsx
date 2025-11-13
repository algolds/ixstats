// src/components/cards/loading/CardSkeleton.tsx
// Animated skeleton loader for cards with glass physics styling

"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

/**
 * CardSkeleton props
 */
export interface CardSkeletonProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Size variant matching CardDisplay */
  size?: "small" | "sm" | "medium" | "md" | "large";
  /** Additional CSS classes */
  className?: string;
  /** Show shimmer effect */
  shimmer?: boolean;
}

/**
 * Size configurations
 */
const SIZE_CONFIGS = {
  small: {
    width: "w-32",
    height: "h-44",
    titleHeight: "h-3",
    typeHeight: "h-2",
    statsHeight: "h-2",
    spacing: "space-y-2",
  },
  sm: {
    width: "w-32",
    height: "h-44",
    titleHeight: "h-3",
    typeHeight: "h-2",
    statsHeight: "h-2",
    spacing: "space-y-2",
  },
  medium: {
    width: "w-48",
    height: "h-64",
    titleHeight: "h-4",
    typeHeight: "h-3",
    statsHeight: "h-3",
    spacing: "space-y-3",
  },
  md: {
    width: "w-48",
    height: "h-64",
    titleHeight: "h-4",
    typeHeight: "h-3",
    statsHeight: "h-3",
    spacing: "space-y-3",
  },
  large: {
    width: "w-64",
    height: "h-80",
    titleHeight: "h-5",
    typeHeight: "h-4",
    statsHeight: "h-4",
    spacing: "space-y-4",
  },
};

/**
 * Single CardSkeleton component
 */
const SingleCardSkeleton: React.FC<{
  size: "small" | "sm" | "medium" | "md" | "large";
  shimmer: boolean;
  delay: number;
}> = ({ size, shimmer, delay }) => {
  const config = SIZE_CONFIGS[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        config.width,
        config.height,
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
      )}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            delay,
          }}
        />
      )}

      {/* Card content skeleton */}
      <div className={cn("flex h-full flex-col p-4", config.spacing)}>
        {/* Artwork area */}
        <div className="flex-1 rounded-lg bg-white/10" />

        {/* Title */}
        <div className={cn(config.titleHeight, "w-full rounded bg-white/10")} />

        {/* Type */}
        <div className={cn(config.typeHeight, "w-2/3 rounded bg-white/10")} />

        {/* Stats */}
        <div className="flex gap-2">
          <div className={cn(config.statsHeight, "w-1/3 rounded bg-white/10")} />
          <div className={cn(config.statsHeight, "w-1/3 rounded bg-white/10")} />
        </div>
      </div>

      {/* Pulse animation */}
      <motion.div
        className="absolute inset-0 bg-white/5"
        animate={{
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      />
    </motion.div>
  );
};

/**
 * CardSkeleton - Loading skeleton for card grid
 *
 * Features:
 * - Animated shimmer effect
 * - Staggered appearance animation
 * - Glass physics styling
 * - Multiple size variants
 * - Configurable count
 *
 * @example
 * ```tsx
 * <CardSkeleton count={6} size="medium" shimmer />
 * ```
 */
export const CardSkeleton = React.memo<CardSkeletonProps>(
  ({ count = 1, size = "medium", className, shimmer = true }) => {
    return (
      <div className={cn("grid gap-4", className)}>
        {Array.from({ length: count }).map((_, index) => (
          <SingleCardSkeleton
            key={index}
            size={size}
            shimmer={shimmer}
            delay={index * 0.05}
          />
        ))}
      </div>
    );
  }
);

CardSkeleton.displayName = "CardSkeleton";
