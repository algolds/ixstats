/**
 * PackHolographicCover — Procedural holographic pack cover
 *
 * Generates a Yu-Gi-Oh-inspired foil cover for card packs using
 * only CSS gradients, blend modes, and animations.  Varies by
 * pack type (color theme) and guaranteed rarity (effect intensity).
 *
 * Layer stack (bottom → top):
 *  1. Base gradient (pack-type color)
 *  2. Holographic pattern (rarity-driven)
 *  3. Geometric accents (diamond outlines)
 *  4. Foil shine sweep
 *  5. Text overlay (pack name + rarity stamp)
 *
 * Keyframes defined in src/styles/animations.css:
 *  holo-drift, foil-sweep, geo-spin
 */

"use client";

import React, { useMemo } from "react";
import { cn } from "~/lib/utils";
import type { CardRarity } from "@prisma/client";
import {
  getRainbowHolographicGradient,
  getSparkleGridGradient,
  getPrismaticWaveGradient,
  getHolofoilTextureGradient,
  getFoilStampConfig,
  getEmbossedTextShadow,
} from "~/lib/holographic-effects";

// ─── Types ──────────────────────────────────────────────────────

export interface PackHolographicCoverProps {
  packType: string;
  guaranteedRarity?: string | null;
  packName?: string;
  className?: string;
  /** sm = store thumb (h-20), md = card, lg = pack-opening fullscreen */
  size?: "sm" | "md" | "lg";
}

// ─── Pack-type base themes ──────────────────────────────────────

interface PackTheme {
  base: string;
  accent: string;
  accentSoft: string;
  hueRotate: number;
}

const PACK_THEMES: Record<string, PackTheme> = {
  BASIC: {
    base: "from-blue-950 via-slate-900 to-blue-950",
    accent: "rgba(59,130,246,0.45)",
    accentSoft: "rgba(59,130,246,0.12)",
    hueRotate: 0,
  },
  PREMIUM: {
    base: "from-violet-950 via-indigo-900 to-violet-950",
    accent: "rgba(139,92,246,0.45)",
    accentSoft: "rgba(139,92,246,0.12)",
    hueRotate: 40,
  },
  ELITE: {
    base: "from-fuchsia-950 via-purple-900 to-fuchsia-950",
    accent: "rgba(236,72,153,0.45)",
    accentSoft: "rgba(236,72,153,0.12)",
    hueRotate: 80,
  },
  EVENT: {
    base: "from-amber-950 via-red-900 to-amber-950",
    accent: "rgba(234,179,8,0.45)",
    accentSoft: "rgba(234,179,8,0.12)",
    hueRotate: 160,
  },
  LIMITED: {
    base: "from-emerald-950 via-teal-900 to-emerald-950",
    accent: "rgba(16,185,129,0.45)",
    accentSoft: "rgba(16,185,129,0.12)",
    hueRotate: 120,
  },
};

// ─── Rarity helpers ─────────────────────────────────────────────

const VALID_RARITIES = new Set(["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"]);

function getEffectiveRarity(rarity?: string | null): CardRarity {
  if (rarity && VALID_RARITIES.has(rarity)) return rarity as CardRarity;
  return "COMMON";
}

function getHoloGradient(rarity: CardRarity): string {
  switch (rarity) {
    case "LEGENDARY":
      return `${getSparkleGridGradient()}, ${getPrismaticWaveGradient()}`;
    case "EPIC":
      return getSparkleGridGradient();
    case "ULTRA_RARE":
      return getPrismaticWaveGradient();
    case "RARE":
      return getRainbowHolographicGradient(135);
    default:
      return getHolofoilTextureGradient();
  }
}

function getSweepSpeed(rarity: CardRarity): number {
  const speeds: Record<CardRarity, number> = {
    COMMON: 4, UNCOMMON: 3.5, RARE: 3, ULTRA_RARE: 2.5, EPIC: 2, LEGENDARY: 1.5,
  };
  return speeds[rarity] ?? 4;
}

function getHoloOpacity(rarity: CardRarity): number {
  const map: Record<CardRarity, number> = {
    COMMON: 0.15, UNCOMMON: 0.25, RARE: 0.35, ULTRA_RARE: 0.45, EPIC: 0.55, LEGENDARY: 0.7,
  };
  return map[rarity] ?? 0.15;
}

// ─── Size presets ───────────────────────────────────────────────

const SIZE_CLASSES = { sm: "h-20", md: "h-40", lg: "h-full min-h-[320px]" } as const;
const LABEL_SIZES = { sm: "text-[9px]", md: "text-xs", lg: "text-base" } as const;
const STAMP_SIZES = { sm: "text-xs h-5 w-5", md: "text-lg h-8 w-8", lg: "text-3xl h-14 w-14" } as const;

// ─── Component ──────────────────────────────────────────────────

export const PackHolographicCover = React.memo<PackHolographicCoverProps>(
  ({ packType, guaranteedRarity, packName, className, size = "sm" }) => {
    const theme = PACK_THEMES[packType.toUpperCase()] ?? PACK_THEMES.BASIC!;
    const rarity = getEffectiveRarity(guaranteedRarity);
    const foilStamp = getFoilStampConfig(rarity);
    const sweepDuration = getSweepSpeed(rarity);
    const holoOpacity = getHoloOpacity(rarity);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    const showGeometry = rarity !== "COMMON";
    const showStamp = foilStamp.enabled && size !== "sm";

    return (
      <div
        className={cn(
          "relative w-full overflow-hidden select-none",
          SIZE_CLASSES[size],
          className,
        )}
      >
        {/* Layer 1: Base gradient */}
        <div className={cn("absolute inset-0 bg-gradient-to-br", theme.base)} />

        {/* Layer 2: Holographic pattern */}
        <div
          className="absolute inset-0 pack-holo-drift"
          style={{
            background: holoGradient,
            backgroundSize: "400% 400%",
            mixBlendMode: "overlay",
            opacity: holoOpacity,
            filter: theme.hueRotate ? `hue-rotate(${theme.hueRotate}deg)` : undefined,
            animation: "holo-drift 8s ease-in-out infinite",
          }}
        />

        {/* Layer 3: Geometric accents */}
        {showGeometry && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="absolute pack-geo-spin"
              style={{
                width: "70%",
                height: "70%",
                border: `1.5px solid ${theme.accent}`,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                animation: "geo-spin 20s linear infinite",
              }}
            />
            <div
              className="absolute pack-geo-spin"
              style={{
                width: "45%",
                height: "45%",
                border: `1px solid ${theme.accentSoft}`,
                background: theme.accentSoft,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                animation: "geo-spin 25s linear infinite reverse",
              }}
            />
            {(rarity === "EPIC" || rarity === "LEGENDARY") && (
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  width: "18%",
                  height: "18%",
                  border: `1px solid ${theme.accent}`,
                  background: `radial-gradient(circle, ${theme.accentSoft} 0%, transparent 70%)`,
                }}
              />
            )}
          </div>
        )}

        {/* Layer 4: Foil shine sweep */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute h-full pack-foil-sweep"
            style={{
              width: "50%",
              top: 0,
              background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.1) 55%, transparent 70%)",
              animation: `foil-sweep ${sweepDuration}s ease-in-out infinite`,
            }}
          />
        </div>

        {/* Layer 5: Text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none">
          {showStamp && (
            <div
              className={cn(
                "mb-1 flex items-center justify-center rounded-full",
                "bg-gradient-to-br shadow-lg backdrop-blur-sm",
                foilStamp.color,
                STAMP_SIZES[size],
              )}
              style={{ textShadow: "0 0 8px rgba(255,255,255,0.8)" }}
            >
              {foilStamp.symbol}
            </div>
          )}

          <div className="relative w-full bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 pb-1.5 pt-4">
            {packName && size !== "sm" && (
              <p
                className={cn(
                  "text-center font-black text-white/90 leading-tight line-clamp-1",
                  LABEL_SIZES[size],
                )}
                style={{
                  textShadow: getEmbossedTextShadow(
                    rarity === "LEGENDARY" ? "gold" : rarity === "EPIC" ? "purple" : "silver"
                  ),
                }}
              >
                {packName}
              </p>
            )}
            <p
              className={cn(
                "text-center font-semibold uppercase tracking-widest text-white/40",
                size === "sm" ? "text-[7px]" : "text-[9px]",
              )}
            >
              IxCards
            </p>
          </div>
        </div>
      </div>
    );
  },
);

PackHolographicCover.displayName = "PackHolographicCover";
