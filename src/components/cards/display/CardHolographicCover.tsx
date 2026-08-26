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

import React, { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "~/lib/utils";
import type { CardRarity } from "@prisma/client";
import {
  getRainbowHolographicGradient,
  getSparkleGridGradient,
  getPrismaticWaveGradient,
  getHolofoilTextureGradient,
  getFoilStampConfig,
} from "~/lib/themes";
import { LoreCardHolographicCover } from "./LoreCardHolographicCover";
import { CategoryIcon } from "~/components/cards/icons";
import { getCategoryTheme } from "~/lib/cards/category-theme";
import { isValidLoreCategory, type LoreCategory } from "~/lib/cards/category-enums";

import type { ResolvedCardDesignMetadata } from "~/lib/cards/card-metadata-resolver";

// ─── Types ──────────────────────────────────────────────────────

export interface CardHolographicCoverProps {
  cardType?: string;
  category?: LoreCategory | string | null;
  rarity: string;
  /** For LORE cards — passed through to LoreCardHolographicCover */
  wikiSource?: string | null;
  title?: string;
  designMetadata?: ResolvedCardDesignMetadata | null;
  isHovered?: boolean;
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

function _getSweepSpeed(rarity: CardRarity): number {
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
  ({
    cardType = "SPECIAL",
    category,
    rarity: rarityStr,
    wikiSource,
    title,
    designMetadata,
    isHovered = false,
    className,
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
      if (!isHovered) return;
      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      };
      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isHovered]);

    const rarity = getEffectiveRarity(rarityStr);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    // Check if category is a valid LoreCategory or if cardType is a LoreCategory
    const resolvedCategory: LoreCategory | null =
      (category && isValidLoreCategory(category) ? (category as LoreCategory) : null) ||
      (isValidLoreCategory(cardType) ? (cardType as LoreCategory) : null);

    // Delegate to LoreCardHolographicCover for LORE cards without explicit resolved category
    if (cardType === "LORE" && !resolvedCategory) {
      return (
        <LoreCardHolographicCover
          rarity={rarityStr}
          wikiSource={wikiSource}
          title={title}
          isHovered={isHovered}
          className={className}
        />
      );
    }

    const categoryTheme = resolvedCategory ? getCategoryTheme(resolvedCategory) : null;
    const theme = CARD_TYPE_THEMES[cardType] ?? DEFAULT_THEME;
    const foilStamp = getFoilStampConfig(rarity);
    const holoOpacity = isHovered ? getHoloOpacity(rarity) : getHoloOpacity(rarity) * 0.4;

    const showMotifs = rarity !== "COMMON";

    return (
      <div
        ref={containerRef}
        className={cn("absolute inset-0 overflow-hidden select-none", className)}
      >
        {/* Layer 1: Base gradient */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br",
            categoryTheme ? categoryTheme.gradient : theme.base
          )}
        />

        {/* Layer 2: Category Pattern or Ink-flow ambient pattern */}
        {categoryTheme ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: categoryTheme.pattern,
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(ellipse at 30% 20%, ${theme.accent} 0%, transparent 50%),
                radial-gradient(ellipse at 70% 80%, ${theme.accentSoft} 0%, transparent 50%)
              `,
              backgroundSize: "200% 200%",
              animation: isHovered ? "lore-ink-flow 12s ease-in-out infinite" : "none",
              opacity: 0.6,
            }}
          />
        )}

        {/* Layer 2b: Custom Watermark Icon or Category Icon Watermark */}
        {designMetadata?.watermarkIcon ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden transition-all duration-300"
            style={{
              opacity: designMetadata.watermarkOpacity ?? 0.35,
              transform: `scale(${designMetadata.watermarkScale ?? 1.2})`,
            }}
          >
            {designMetadata.watermarkColor ? (
              <div
                className="h-full w-full"
                style={{
                  maskImage: `url(${designMetadata.watermarkIcon.path})`,
                  WebkitMaskImage: `url(${designMetadata.watermarkIcon.path})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                  backgroundColor: designMetadata.watermarkColor,
                }}
              />
            ) : (
              <img
                src={designMetadata.watermarkIcon.path}
                alt="Watermark"
                className="h-full w-full object-contain opacity-90 invert filter"
              />
            )}
          </div>
        ) : resolvedCategory ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 opacity-35">
            <CategoryIcon
              category={resolvedCategory}
              treatment="watermark"
              color={
                designMetadata?.watermarkColor ||
                designMetadata?.accentColorOverride ||
                categoryTheme?.accentColor
              }
              className="max-h-[60%] max-w-[60%]"
            />
          </div>
        ) : null}

        {/* Layer 2c: Center Emblem Icon if provided */}
        {designMetadata?.emblemIcon && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className="relative flex items-center justify-center rounded-full p-6 transition-all duration-300"
              style={{
                transform: `scale(${designMetadata.emblemScale ?? 1.0})`,
                background: "radial-gradient(circle, rgba(0,0,0,0.5) 0%, transparent 70%)",
              }}
            >
              {designMetadata.emblemColor ? (
                <div
                  className="h-20 w-20"
                  style={{
                    maskImage: `url(${designMetadata.emblemIcon.path})`,
                    WebkitMaskImage: `url(${designMetadata.emblemIcon.path})`,
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                    backgroundColor: designMetadata.emblemColor,
                  }}
                />
              ) : (
                <img
                  src={designMetadata.emblemIcon.path}
                  alt="Emblem"
                  className="h-20 w-20 object-contain invert filter"
                />
              )}
            </div>
          </div>
        )}

        {/* Layer 3: Holographic pattern with pointer backgroundPosition */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: holoGradient,
            backgroundSize: "400% 400%",
            backgroundPosition:
              isHovered && containerRef.current
                ? `${(mousePos.x / (containerRef.current.offsetWidth || 1)) * 100}% ${(mousePos.y / (containerRef.current.offsetHeight || 1)) * 100}%`
                : "50% 50%",
            mixBlendMode: "overlay",
            opacity: holoOpacity,
            filter: theme.hueRotate ? `hue-rotate(${theme.hueRotate}deg)` : undefined,
            transition: "background-position 0.1s ease-out",
          }}
        />

        {/* Layer 4: Geometric motifs */}
        {showMotifs && !resolvedCategory && !designMetadata?.emblemIcon && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* Outer frame */}
            <div
              className="absolute rounded-lg border"
              style={{
                width: "60%",
                height: "75%",
                borderColor: theme.accent,
                borderWidth: "1px",
                animation: isHovered ? "geo-spin 30s linear infinite" : "none",
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
                animation: isHovered ? "geo-spin 35s linear infinite reverse" : "none",
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

        {/* Layer 5: Specular Cursor Spotlight */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 140px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.12) 40%, transparent 80%)`,
            }}
          />
        )}

        {/* Layer 6: Center label (if no resolved category watermark) */}
        {!resolvedCategory && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="space-y-1 px-4 text-center">
              <p className="text-[9px] font-semibold tracking-[0.25em] text-white/25 uppercase">
                {theme.label}
              </p>
              <p className="text-[8px] tracking-[0.2em] text-white/15 uppercase">
                {theme.sublabel}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CardHolographicCover.displayName = "CardHolographicCover";
