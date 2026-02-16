/**
 * SeasonBadge Component
 * Displays season number with season-specific color coding
 * Positioned as a floating badge on cards
 */

"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

/**
 * SeasonBadge component props
 */
export interface SeasonBadgeProps {
  /** Season number */
  season: number;
  /** Badge size variant */
  size?: "small" | "medium" | "large";
  /** Badge position on card */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Enable hover animation */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get season-specific color configuration
 * Each season has a unique color scheme for visual variety
 */
function getSeasonColors(season: number): {
  bgGradient: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
} {
  const colors: Record<number, {
    bgGradient: string;
    borderColor: string;
    textColor: string;
    glowColor: string;
  }> = {
    1: {
      bgGradient: "from-blue-500 to-blue-600",
      borderColor: "border-blue-400",
      textColor: "text-white",
      glowColor: "shadow-blue-500/50",
    },
    2: {
      bgGradient: "from-green-500 to-emerald-600",
      borderColor: "border-green-400",
      textColor: "text-white",
      glowColor: "shadow-green-500/50",
    },
    3: {
      bgGradient: "from-purple-500 to-violet-600",
      borderColor: "border-purple-400",
      textColor: "text-white",
      glowColor: "shadow-purple-500/50",
    },
    4: {
      bgGradient: "from-orange-500 to-red-600",
      borderColor: "border-orange-400",
      textColor: "text-white",
      glowColor: "shadow-orange-500/50",
    },
    5: {
      bgGradient: "from-pink-500 to-rose-600",
      borderColor: "border-pink-400",
      textColor: "text-white",
      glowColor: "shadow-pink-500/50",
    },
  };

  // Default to blue for seasons beyond 5
  return colors[season] ?? colors[1]!;
}

/**
 * SeasonBadge - Season indicator badge for trading cards
 *
 * Features:
 * - Season-specific color coding
 * - Circular badge design
 * - Floating positioning
 * - Hover animations
 * - GPU-accelerated transforms
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <CardDisplay card={card} />
 *   <SeasonBadge season={2} position="top-right" />
 * </div>
 * ```
 */
export const SeasonBadge = React.memo<SeasonBadgeProps>(
  ({
    season,
    size = "medium",
    position = "top-right",
    animated = true,
    className,
  }) => {
    const colors = getSeasonColors(season);

    // Size-dependent dimensions
    const sizeClasses = {
      small: {
        container: "h-6 w-6",
        text: "text-xs",
        offset: "top-1 right-1",
      },
      medium: {
        container: "h-8 w-8",
        text: "text-sm",
        offset: "top-2 right-2",
      },
      large: {
        container: "h-10 w-10",
        text: "text-base",
        offset: "top-2 right-2",
      },
    };

    const sizeConfig = sizeClasses[size];

    // Position classes
    const positionClasses = {
      "top-right": "top-2 right-2",
      "top-left": "top-2 left-2",
      "bottom-right": "bottom-2 right-2",
      "bottom-left": "bottom-2 left-2",
    };

    return (
      <motion.div
        className={cn(
          // Base positioning
          "absolute z-10",
          positionClasses[position],
          // Size
          sizeConfig.container,
          // Flex centering
          "flex items-center justify-center",
          // Shape
          "rounded-full",
          // Background gradient
          "bg-gradient-to-br",
          colors.bgGradient,
          // Border
          "border-2",
          colors.borderColor,
          // Shadow/glow
          "shadow-lg",
          colors.glowColor,
          // Text
          "font-black",
          colors.textColor,
          sizeConfig.text,
          // Transform
          "will-change-transform",
          // Custom classes
          className
        )}
        initial={{ scale: 0, rotate: -180 }}
        animate={{
          scale: 1,
          rotate: 0,
        }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          duration: 0.5,
        }}
        whileHover={
          animated
            ? {
                scale: 1.15,
                rotate: 360,
                transition: { duration: 0.4 },
              }
            : undefined
        }
        style={{
          textShadow: "0 1px 2px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)",
        }}
      >
        <span className="relative z-10">S{season}</span>

        {/* Static shine effect - no continuous rotation */}
        {animated && (
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-60"
            style={{
              clipPath: "polygon(40% 0%, 60% 0%, 60% 100%, 40% 100%)",
              transform: "rotate(45deg)",
            }}
          />
        )}

        {/* Glass physics overlay */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 via-transparent to-black/20 mix-blend-overlay" />
      </motion.div>
    );
  }
);

SeasonBadge.displayName = "SeasonBadge";
