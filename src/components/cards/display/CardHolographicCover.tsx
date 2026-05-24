/**
 * CardHolographicCover — Universal procedural holographic fallback for ALL card types
 *
 * Generates a dynamic cover when any card has no artwork or the image fails to load.
 * Each CardType gets a unique theme (colors, motifs, label).
 *
 * For LORE cards, delegates to LoreCardHolographicCover for wiki-source theming.
 *
 * Layer stack (bottom → top):
 *  1. Base gradient (card-type color)
 *  2. Ink-flow ambient pattern
 *  3. Holographic overlay (rarity-driven intensity)
 *  4. Geometric motifs (card-type specific)
 *  5. Foil shine sweep
 *  6. Center label
 */

"use client";

import React, { useMemo } from "react";
import { cn } from "~/lib/utils";
import type { CardRarity, CardType } from "@prisma/client";
import {
  getRainbowHolographicGradient,
  getSparkleGridGradient,
  getPrismaticWaveGradient,
  getHolofoilTextureGradient,
  getFoilStampConfig,
} from "~/lib/holographic-effects";
import { LoreCardHolographicCover } from "./LoreCardHolographicCover";

// ─── Types ──────────────────────────────────────────────────────

export interface CardHolographicCoverProps {
  cardType: string;
  rarity: string;
  /** For LORE cards — passed through to LoreCardHolographicCover */
  wikiSource?: string | null;
  title?: string;
  className?: string;
}

// ─── Card-type themes ───────────────────────────────────────────

interface CardTypeTheme {
  base: string;
  accent: string;
  accentSoft: string;
  hueRotate: number;
  label: string;
  sublabel: string;
  motifSymbol: string;
}

const CARD_TYPE_THEMES: Record<string, CardTypeTheme> = {
  NATION: {
    base: "from-amber-950 via-yellow-950 to-slate-950",
    accent: "rgba(245,158,11,0.4)",
    accentSoft: "rgba(245,158,11,0.1)",
    hueRotate: 30,
    label: "Nation",
    sublabel: "Sovereign State",
    motifSymbol: "🏛️",
  },
  NS_IMPORT: {
    base: "from-emerald-950 via-cyan-950 to-slate-950",
    accent: "rgba(6,182,212,0.4)",
    accentSoft: "rgba(6,182,212,0.1)",
    hueRotate: 160,
    label: "NationStates",
    sublabel: "Imported Card",
    motifSymbol: "🌍",
  },
  SPECIAL: {
    base: "from-rose-950 via-pink-950 to-slate-950",
    accent: "rgba(244,63,94,0.4)",
    accentSoft: "rgba(244,63,94,0.1)",
    hueRotate: -30,
    label: "Special",
    sublabel: "Limited Edition",
    motifSymbol: "⭐",
  },
  COMMUNITY: {
    base: "from-violet-950 via-fuchsia-950 to-slate-950",
    accent: "rgba(168,85,247,0.4)",
    accentSoft: "rgba(168,85,247,0.1)",
    hueRotate: 270,
    label: "Community",
    sublabel: "Player Created",
    motifSymbol: "🤝",
  },
};

const DEFAULT_THEME: CardTypeTheme = {
  base: "from-slate-950 via-zinc-950 to-neutral-950",
  accent: "rgba(148,163,184,0.4)",
  accentSoft: "rgba(148,163,184,0.1)",
  hueRotate: 0,
  label: "IxCards",
  sublabel: "Trading Card",
  motifSymbol: "🎴",
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
    COMMON: 0.12,
    UNCOMMON: 0.2,
    RARE: 0.3,
    ULTRA_RARE: 0.4,
    EPIC: 0.5,
    LEGENDARY: 0.65,
  };
  return map[rarity] ?? 0.12;
}

function getSweepSpeed(rarity: CardRarity): number {
  const speeds: Record<CardRarity, number> = {
    COMMON: 5,
    UNCOMMON: 4,
    RARE: 3.5,
    ULTRA_RARE: 3,
    EPIC: 2.5,
    LEGENDARY: 2,
  };
  return speeds[rarity] ?? 5;
}

// ─── Component ──────────────────────────────────────────────────

export const CardHolographicCover = React.memo<CardHolographicCoverProps>(
  ({ cardType, rarity: rarityStr, wikiSource, title, className }) => {
    const rarity = getEffectiveRarity(rarityStr);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    // Delegate to LoreCardHolographicCover for LORE cards
    if (cardType === "LORE") {
      return (
        <LoreCardHolographicCover
          rarity={rarityStr}
          wikiSource={wikiSource}
          title={title}
          className={className}
        />
      );
    }

    const theme = CARD_TYPE_THEMES[cardType] ?? DEFAULT_THEME;
    const foilStamp = getFoilStampConfig(rarity);
    const holoOpacity = getHoloOpacity(rarity);
    const sweepDuration = getSweepSpeed(rarity);

    const showMotifs = rarity !== "COMMON";

    return (
      <div className={cn("absolute inset-0 overflow-hidden select-none", className)}>
        {/* Layer 1: Base gradient */}
        <div className={cn("absolute inset-0 bg-gradient-to-br", theme.base)} />

        {/* Layer 2: Ink-flow ambient pattern */}
        <div
          className="absolute inset-0"
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
          className="absolute inset-0"
          style={{
            background: holoGradient,
            backgroundSize: "400% 400%",
            mixBlendMode: "overlay",
            opacity: holoOpacity,
            filter: theme.hueRotate ? `hue-rotate(${theme.hueRotate}deg)` : undefined,
            animation: "holo-drift 10s ease-in-out infinite",
          }}
        />

        {/* Layer 4: Geometric motifs */}
        {showMotifs && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* Outer frame */}
            <div
              className="absolute rounded-lg border"
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
              className="absolute"
              style={{
                width: "35%",
                height: "35%",
                border: `1px solid ${theme.accentSoft}`,
                background: theme.accentSoft,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                animation: "geo-spin 35s linear infinite reverse",
              }}
            />
            {/* Center emblem for EPIC+ */}
            {(rarity === "EPIC" || rarity === "LEGENDARY") && (
              <div
                className="absolute flex items-center justify-center text-xl opacity-40"
                style={{
                  width: "15%",
                  height: "15%",
                  textShadow: `0 0 12px ${theme.accent}`,
                }}
              >
                {foilStamp.enabled ? foilStamp.symbol : theme.motifSymbol}
              </div>
            )}
          </div>
        )}

        {/* Layer 5: Foil shine sweep */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute h-full"
            style={{
              width: "50%",
              top: 0,
              background:
                "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 55%, transparent 70%)",
              animation: `foil-sweep ${sweepDuration}s ease-in-out infinite`,
            }}
          />
        </div>

        {/* Layer 6: Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="space-y-1 px-4 text-center">
            <p className="text-[9px] font-semibold tracking-[0.25em] text-white/25 uppercase">
              {theme.label}
            </p>
            <p className="text-[8px] tracking-[0.2em] text-white/15 uppercase">{theme.sublabel}</p>
          </div>
        </div>
      </div>
    );
  }
);

CardHolographicCover.displayName = "CardHolographicCover";
