/**
 * LoreCardHolographicCover — Procedural holographic fallback for lore cards
 *
 * Generates a dynamic cover when a lore card has no artwork.
 * Themed around scrolls / archives / wiki sources.
 *
 * Layer stack (bottom → top):
 *  1. Base gradient (wiki-source color: blue for IxWiki, green for IIWiki)
 *  2. Holographic pattern (rarity-driven intensity)
 *  3. Scroll / archive motifs (CSS geometric shapes)
 *  4. Foil shine sweep
 *  5. "Historical Archive" label
 *
 * Keyframes from src/styles/animations.css:
 *  holo-drift, foil-sweep, geo-spin, lore-ink-flow
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
} from "~/lib/holographic-effects";

// ─── Types ──────────────────────────────────────────────────────

export interface LoreCardHolographicCoverProps {
  rarity: string;
  wikiSource?: string | null;
  title?: string;
  className?: string;
}

// ─── Wiki-source themes ─────────────────────────────────────────

interface LoreTheme {
  base: string;
  accent: string;
  accentSoft: string;
  hueRotate: number;
  label: string;
}

const LORE_THEMES: Record<string, LoreTheme> = {
  ixwiki: {
    base: "from-blue-950 via-indigo-950 to-slate-950",
    accent: "rgba(59,130,246,0.4)",
    accentSoft: "rgba(59,130,246,0.1)",
    hueRotate: 0,
    label: "IxWiki",
  },
  iiwiki: {
    base: "from-emerald-950 via-teal-950 to-slate-950",
    accent: "rgba(16,185,129,0.4)",
    accentSoft: "rgba(16,185,129,0.1)",
    hueRotate: 100,
    label: "IIWiki",
  },
  default: {
    base: "from-purple-950 via-indigo-950 to-slate-950",
    accent: "rgba(147,51,234,0.4)",
    accentSoft: "rgba(147,51,234,0.1)",
    hueRotate: 60,
    label: "Archive",
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

function getHoloOpacity(rarity: CardRarity): number {
  const map: Record<CardRarity, number> = {
    COMMON: 0.12, UNCOMMON: 0.2, RARE: 0.3, ULTRA_RARE: 0.4, EPIC: 0.5, LEGENDARY: 0.65,
  };
  return map[rarity] ?? 0.12;
}

function getSweepSpeed(rarity: CardRarity): number {
  const speeds: Record<CardRarity, number> = {
    COMMON: 5, UNCOMMON: 4, RARE: 3.5, ULTRA_RARE: 3, EPIC: 2.5, LEGENDARY: 2,
  };
  return speeds[rarity] ?? 5;
}

// ─── Component ──────────────────────────────────────────────────

export const LoreCardHolographicCover = React.memo<LoreCardHolographicCoverProps>(
  ({ rarity: rarityStr, wikiSource, title: _title, className }) => {
    const themeKey = wikiSource === "ixwiki" ? "ixwiki" : wikiSource === "iiwiki" ? "iiwiki" : "default";
    const theme = LORE_THEMES[themeKey]!;
    const rarity = getEffectiveRarity(rarityStr);
    const foilStamp = getFoilStampConfig(rarity);
    const holoOpacity = getHoloOpacity(rarity);
    const sweepDuration = getSweepSpeed(rarity);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    const showMotifs = rarity !== "COMMON";

    return (
      <div className={cn("absolute inset-0 overflow-hidden select-none", className)}>
        {/* Layer 1: Base gradient */}
        <div className={cn("absolute inset-0 bg-gradient-to-br", theme.base)} />

        {/* Layer 2: Ink-flow pattern (lore-specific slow drift) */}
        <div
          className="absolute inset-0 lore-ink-flow"
          style={{
            background: `
              radial-gradient(ellipse at 30% 20%, ${theme.accent} 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, ${theme.accentSoft} 0%, transparent 50%)
            `,
            backgroundSize: "200% 200%",
            animation: "lore-ink-flow 12s ease-in-out infinite",
            opacity: 0.6,
          }}
        />

        {/* Layer 3: Holographic pattern */}
        <div
          className="absolute inset-0 pack-holo-drift"
          style={{
            background: holoGradient,
            backgroundSize: "400% 400%",
            mixBlendMode: "overlay",
            opacity: holoOpacity,
            filter: theme.hueRotate ? `hue-rotate(${theme.hueRotate}deg)` : undefined,
            animation: "holo-drift 10s ease-in-out infinite",
          }}
        />

        {/* Layer 4: Scroll / archive motifs */}
        {showMotifs && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Outer scroll frame — rounded rectangle outline */}
            <div
              className="absolute border rounded-lg pack-geo-spin"
              style={{
                width: "60%",
                height: "75%",
                borderColor: theme.accent,
                borderWidth: "1px",
                animation: "geo-spin 30s linear infinite",
              }}
            />
            {/* Inner ornamental diamond */}
            <div
              className="absolute pack-geo-spin"
              style={{
                width: "35%",
                height: "35%",
                border: `1px solid ${theme.accentSoft}`,
                background: theme.accentSoft,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                animation: "geo-spin 35s linear infinite reverse",
              }}
            />
            {/* Center scroll emblem for EPIC+ */}
            {(rarity === "EPIC" || rarity === "LEGENDARY") && (
              <div
                className="absolute flex items-center justify-center text-xl opacity-40"
                style={{
                  width: "15%",
                  height: "15%",
                  textShadow: `0 0 12px ${theme.accent}`,
                }}
              >
                {foilStamp.enabled ? foilStamp.symbol : "📜"}
              </div>
            )}
          </div>
        )}

        {/* Layer 5: Foil shine sweep */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute h-full pack-foil-sweep"
            style={{
              width: "50%",
              top: 0,
              background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 55%, transparent 70%)",
              animation: `foil-sweep ${sweepDuration}s ease-in-out infinite`,
            }}
          />
        </div>

        {/* Layer 6: "Historical Archive" label at center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center space-y-1 px-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/25">
              {theme.label}
            </p>
            <p className="text-[8px] uppercase tracking-[0.2em] text-white/15">
              Historical Archive
            </p>
          </div>
        </div>
      </div>
    );
  },
);

LoreCardHolographicCover.displayName = "LoreCardHolographicCover";
