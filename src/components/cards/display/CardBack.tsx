/**
 * CardBack Component - Premium Card Back Design
 * Animated holographic card back with IxStats branding
 * Designed for 3D flip animations with Card3DViewer
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import type { CardRarity } from "@prisma/client";
import { cn } from "~/lib/utils";
import {
  getHolographicPattern,
  getHolographicIntensity,
  getRainbowHolographicGradient,
  getMetallicGradient,
  generateLightRays,
  getPremiumBorderConfig,
} from "~/lib/holographic-effects";

/**
 * CardBack component props
 */
export interface CardBackProps {
  /** Card rarity (determines holographic effect) */
  rarity?: CardRarity;
  /** Card size for consistent dimensions */
  size?: "small" | "sm" | "medium" | "md" | "large";
  /** Additional CSS classes */
  className?: string;
  /** Disable animations (performance mode) */
  performanceMode?: boolean;
  /** Enable subtle rarity variations */
  showRarityVariation?: boolean;
}

/**
 * CardBack - Premium animated card back design
 *
 * Features:
 * - Centered IxStats logo
 * - Animated holographic pattern with moving light rays
 * - Rarity-specific back variations (subtle)
 * - Glass physics gradient overlay
 * - 3D flip-ready design
 * - GPU-accelerated animations
 *
 * @example
 * ```tsx
 * <CardBack rarity="LEGENDARY" size="medium" />
 * ```
 */
export const CardBack = React.memo<CardBackProps>(
  ({
    rarity = "COMMON",
    size = "medium",
    className,
    performanceMode = false,
    showRarityVariation = true,
  }) => {
    const pattern = getHolographicPattern(rarity);
    const intensity = getHolographicIntensity(rarity);
    const borderConfig = getPremiumBorderConfig(rarity);
    const lightRays = generateLightRays(12);

    // Size-dependent dimensions (match CardDisplay)
    const dimensions = {
      small: { width: "w-32", height: "h-[179px]" },
      sm: { width: "w-32", height: "h-[179px]" },
      medium: { width: "w-48", height: "h-[269px]" },
      md: { width: "w-48", height: "h-[269px]" },
      large: { width: "w-64", height: "h-[358px]" },
    };

    const { width, height } = dimensions[size];

    // Rarity-specific accent colors for subtle variation
    const rarityAccents: Record<CardRarity, string> = {
      COMMON: "from-gray-600 to-gray-800",
      UNCOMMON: "from-green-600 to-emerald-800",
      RARE: "from-blue-600 to-purple-800",
      ULTRA_RARE: "from-purple-600 to-pink-800",
      EPIC: "from-orange-600 to-red-800",
      LEGENDARY: "from-yellow-600 via-orange-600 to-red-800",
    };

    const accentGradient = showRarityVariation
      ? rarityAccents[rarity]
      : "from-gray-700 to-gray-900";

    return (
      <div
        className={cn(
          width,
          height,
          "relative overflow-hidden rounded-2xl",
          className
        )}
      >
        {/* Base background layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950">
          {/* Radial gradient for depth */}
          <div className="absolute inset-0 bg-radial from-slate-800/40 to-transparent" />
        </div>

        {/* Rarity accent gradient (subtle) */}
        <motion.div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-20",
            accentGradient
          )}
          animate={
            !performanceMode
              ? {
                  opacity: [0.15, 0.25, 0.15],
                }
              : undefined
          }
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Animated light rays */}
        {!performanceMode && (
          <div className="absolute inset-0">
            {lightRays.map((ray, index) => (
              <motion.div
                key={index}
                className="absolute left-1/2 top-1/2 w-1 origin-left bg-gradient-to-r from-white/10 to-transparent"
                style={{
                  height: `${ray.length}%`,
                  transform: `rotate(${ray.angle}deg)`,
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{
                  opacity: [0, 0.4, 0],
                  scaleX: [0, 1, 0],
                }}
                transition={{
                  duration: 3,
                  delay: ray.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Holographic pattern overlay */}
        {!performanceMode && (
          <motion.div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              background:
                pattern === "rainbow-shimmer"
                  ? getRainbowHolographicGradient(45, true)
                  : pattern === "cosmic"
                  ? "radial-gradient(circle at 50% 50%, rgba(147,51,234,0.3), rgba(236,72,153,0.2), rgba(59,130,246,0.1))"
                  : getMetallicGradient("silver"),
              backgroundSize: "200% 200%",
            }}
            animate={{
              backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {/* Central glass physics frame */}
        <div className="absolute inset-[10%] rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm">
          {/* Inner frame */}
          <div className="absolute inset-[8%] rounded-lg border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
            {/* Centered IxStats logo container */}
            <div className="flex h-full w-full items-center justify-center">
              <motion.div
                className="relative flex flex-col items-center justify-center"
                animate={
                  !performanceMode
                    ? {
                        scale: [1, 1.05, 1],
                        rotate: [0, 2, 0, -2, 0],
                      }
                    : undefined
                }
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Logo glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 blur-xl"
                  animate={
                    !performanceMode
                      ? {
                          opacity: [0.3, 0.6, 0.3],
                          scale: [1, 1.2, 1],
                        }
                      : undefined
                  }
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* IxStats logo text */}
                <div className="relative z-10 flex flex-col items-center">
                  <motion.div
                    className={cn(
                      "font-black text-white",
                      size === "large"
                        ? "text-4xl"
                        : size === "medium" || size === "md"
                        ? "text-2xl"
                        : "text-xl"
                    )}
                    style={{
                      textShadow:
                        "0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(147, 51, 234, 0.6), 0 2px 4px rgba(0,0,0,0.8)",
                      WebkitTextStroke: "1px rgba(255,255,255,0.3)",
                      background:
                        "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    IxStats
                  </motion.div>
                  <motion.div
                    className={cn(
                      "mt-1 font-semibold text-white/60",
                      size === "large"
                        ? "text-sm"
                        : size === "medium" || size === "md"
                        ? "text-xs"
                        : "text-[10px]"
                    )}
                    style={{
                      textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    }}
                  >
                    TRADING CARD
                  </motion.div>

                  {/* Rarity indicator (subtle) */}
                  {showRarityVariation &&
                    rarity !== "COMMON" &&
                    rarity !== "UNCOMMON" && (
                      <motion.div
                        className={cn(
                          "mt-2 rounded-full px-2 py-0.5 text-[8px] font-bold backdrop-blur-sm",
                          borderConfig.glow
                        )}
                        style={{
                          background: `linear-gradient(135deg, ${accentGradient})`,
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                        animate={
                          !performanceMode
                            ? {
                                opacity: [0.6, 0.9, 0.6],
                              }
                            : undefined
                        }
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        {rarity.replace("_", " ")}
                      </motion.div>
                    )}
                </div>

                {/* Decorative corner accents */}
                <div className="absolute -left-8 -top-8 h-6 w-6 border-l-2 border-t-2 border-white/20" />
                <div className="absolute -right-8 -top-8 h-6 w-6 border-r-2 border-t-2 border-white/20" />
                <div className="absolute -bottom-8 -left-8 h-6 w-6 border-b-2 border-l-2 border-white/20" />
                <div className="absolute -bottom-8 -right-8 h-6 w-6 border-b-2 border-r-2 border-white/20" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Animated shimmer sweep */}
        {!performanceMode && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            style={{
              transform: "skewX(-20deg)",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 2,
            }}
          />
        )}

        {/* Premium border with rarity glow */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-2xl",
            `border-${borderConfig.width}`,
            borderConfig.glow
          )}
          style={{
            borderColor: "rgba(255,255,255,0.1)",
          }}
          animate={
            !performanceMode && borderConfig.animated
              ? {
                  borderColor: [
                    "rgba(255,255,255,0.1)",
                    "rgba(255,255,255,0.3)",
                    "rgba(255,255,255,0.1)",
                  ],
                }
              : undefined
          }
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Glass physics depth overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-black/20 mix-blend-overlay" />
      </div>
    );
  }
);

CardBack.displayName = "CardBack";
