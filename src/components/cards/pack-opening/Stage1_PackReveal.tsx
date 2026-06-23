// src/components/cards/pack-opening/Stage1_PackReveal.tsx
// Stage 1: Pack appearance with 3D rotation and pulsing glow

"use client";

import React from "react";
import { motion } from "motion/react";
import type { PackType } from "@prisma/client";
import { PackHolographicCover } from "./PackHolographicCover";

interface Stage1_PackRevealProps {
  packType: PackType;
  packArtwork?: string;
  onTap: () => void;
}

/**
 * Pack type glow colors
 */
const PACK_GLOW_COLORS: Record<PackType, string> = {
  BASIC: "rgba(59, 130, 246, 0.4)", // blue
  PREMIUM: "rgba(139, 92, 246, 0.4)", // violet
  ELITE: "rgba(236, 72, 153, 0.4)", // pink
  THEMED: "rgba(14, 165, 233, 0.4)", // sky
  SEASONAL: "rgba(34, 197, 94, 0.4)", // green
  EVENT: "rgba(234, 179, 8, 0.4)", // yellow
};

/**
 * Stage1_PackReveal - 3D pack appearance with rotation animation
 *
 * Features:
 * - 3D rotation animation on enter (2s)
 * - Pulsing glow effect
 * - Pack type-specific artwork
 * - Tap to proceed instruction
 */
export const Stage1_PackReveal = React.memo<Stage1_PackRevealProps>(
  ({ packType, packArtwork, onTap }) => {
    const glowColor = PACK_GLOW_COLORS[packType] ?? PACK_GLOW_COLORS.BASIC;

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />

        {/* Animated pack container */}
        <motion.div
          initial={{ rotateY: 0, scale: 0.8, opacity: 0 }}
          animate={{
            rotateY: 360,
            scale: 1,
            opacity: 1,
          }}
          transition={{
            rotateY: {
              duration: 2,
              ease: "easeInOut",
            },
            scale: {
              duration: 0.8,
              ease: "easeOut",
            },
            opacity: {
              duration: 0.5,
            },
          }}
          style={{
            perspective: "1000px",
            transformStyle: "preserve-3d",
          }}
          className="relative cursor-pointer"
          onClick={onTap}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTap();
            }
          }}
          aria-label="Tap to open pack"
        >
          {/* Pulsing glow effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              backgroundColor: glowColor,
            }}
          />

          {/* Pack image */}
          <div className="relative h-96 w-72 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-1 backdrop-blur-sm">
            {/* Inner glow border */}
            <div className="h-full w-full rounded-xl bg-gradient-to-br from-white/5 to-transparent p-4">
              {/* Pack artwork */}
              <PackHolographicCover
                packType={packType}
                packArtwork={packArtwork}
                size="lg"
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Floating particles around pack */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                backgroundColor: glowColor,
                top: `${20 + (i % 3) * 20}%`,
                left: i < 3 ? "-10%" : "110%",
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 2 + i * 0.3,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>

        {/* Tap instruction */}
        <motion.div
          className="absolute bottom-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.5 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-xl font-semibold text-white/90"
          >
            Tap to Open
          </motion.div>
          <div className="mt-2 text-sm text-white/60">{packType} Pack</div>
        </motion.div>
      </div>
    );
  }
);

Stage1_PackReveal.displayName = "Stage1_PackReveal";
