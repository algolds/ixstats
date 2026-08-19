/**
 * CardBack Component - Premium Physical Card Back Design
 * Unified Rarity-Driven Card Back with 3 Selectable Visual Layouts:
 * 1. "lattice": Full Guilloche Lore Category Icon Grid with Theme Accent Colors (Default)
 * 2. "zodiac": Lore Category Zodiac Ring & Swirl Crest
 * 3. "runes": Twin Category Rune Pillar Columns
 *
 * Apple-Grade Holographic Security Medallion (/apple-design):
 * 3D Embossed Metallic Base Foil Substrate matching Front Card Rarity Palette,
 * Micro-Grating Lines, Color-Dodge Prismatic Diffraction, and Specular Glare Sweeps.
 *
 * Mouse/Movement Interactive Physics:
 * All holographic diffraction waves, background shimmer, and glare sweeps are 100% reactive
 * to pointer movement (no continuous automatic looping animations).
 */

"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import type { CardRarity } from "@prisma/client";
import { cn } from "~/lib/utils";
import {
  getHolographicPattern,
  getRainbowHolographicGradient,
  getMetallicGradient,
  generateLightRays,
} from "~/lib/themes";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";
import { CATEGORY_ICONS } from "~/components/cards/icons/icon-paths";
import { getCategoryTheme } from "~/lib/cards";
import type { LoreCategory } from "~/lib/cards/category-enums";
import type { CardInstance } from "~/types/cards-display";
import { getCardSerialNumber, getCardEditionLabel } from "~/lib/cards";
import { withBasePath } from "~/lib/base-path";

export type CardBackVariant = "lattice" | "zodiac" | "runes";

export interface CardBackProps {
  /** Card rarity (determines holographic color glow & card back theme) */
  rarity?: CardRarity | string;
  /** Lore Category for Category Accent Hybrid Engine */
  category?: LoreCategory | string;
  /** Enable Category Accent Hybrid Tinting (default true) */
  enableCategoryTint?: boolean;
  /** Card size */
  size?: "small" | "sm" | "medium" | "md" | "large";
  /** Card back visual layout option (defaults to "lattice") */
  variant?: CardBackVariant;
  /** Card model instance (used for serial number, season & edition) */
  card?: CardInstance | null;
  /** Custom card name override */
  cardName?: string;
  /** Custom serial number override e.g. "00049281" */
  serialNumber?: string;
  /** Custom edition label e.g. "1ST EDITION" */
  edition?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable heavy motion animations */
  performanceMode?: boolean;
  /** Enable subtle rarity accent variations */
  showRarityVariation?: boolean;
}

const ALL_CATEGORY_KEYS: LoreCategory[] = [
  "MILITARY",
  "DIPLOMACY",
  "GEOGRAPHY",
  "RELIGION",
  "CULTURE",
  "GOVERNMENT",
  "PEOPLE",
  "ECONOMY",
  "SCIENCE",
  "HISTORY",
  "NATION",
  "SPECIAL",
];

export interface RarityBackTheme {
  borderOuter: string;
  borderInner: string;
  cornerBracket: string;
  medallionBorder: string;
  auraGlow: string;
  medallionGlow: string;
  cardGlow: string;
  textPrimary: string;
  textSecondary: string;
  badgeBg: string;
  badgeBorder: string;
  foilGradient: string;
  foilDiffraction: string;
  textureType: TextureType;
  textureOpacity: number;
}

export const RARITY_THEMES: Record<string, RarityBackTheme> = {
  COMMON: {
    borderOuter: "border-slate-500/40",
    borderInner: "border-slate-400/20",
    cornerBracket: "border-slate-300",
    medallionBorder: "border-slate-400/70",
    auraGlow: "from-slate-600/30 to-slate-900/60",
    medallionGlow: "shadow-[0_0_20px_rgba(148,163,184,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-slate-500/20",
    textPrimary: "text-slate-200",
    textSecondary: "text-slate-400/90",
    badgeBg: "bg-slate-900/90",
    badgeBorder: "border-slate-400/40",
    foilGradient:
      "linear-gradient(135deg, #f1f5f9 0%, #ffffff 30%, #94a3b8 60%, #cbd5e1 80%, #475569 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(148,163,184,0.6) 0deg, rgba(226,232,240,0.7) 120deg, rgba(100,116,139,0.6) 240deg, rgba(148,163,184,0.6) 360deg)",
    textureType: "paperGrain",
    textureOpacity: 0.05,
  },
  UNCOMMON: {
    borderOuter: "border-emerald-500/50",
    borderInner: "border-emerald-400/30",
    cornerBracket: "border-emerald-400",
    medallionBorder: "border-emerald-400/80",
    auraGlow: "from-emerald-600/30 to-teal-950/70",
    medallionGlow: "shadow-[0_0_22px_rgba(52,211,153,0.4),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-emerald-500/30",
    textPrimary: "text-emerald-200",
    textSecondary: "text-emerald-300/90",
    badgeBg: "bg-emerald-950/90",
    badgeBorder: "border-emerald-400/40",
    foilGradient:
      "linear-gradient(135deg, #a7f3d0 0%, #ffffff 25%, #059669 50%, #6ee7b7 75%, #047857 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(52,211,153,0.6) 0deg, rgba(56,189,248,0.6) 120deg, rgba(167,243,208,0.7) 240deg, rgba(52,211,153,0.6) 360deg)",
    textureType: "crosshatch",
    textureOpacity: 0.04,
  },
  RARE: {
    borderOuter: "border-blue-500/50",
    borderInner: "border-blue-400/30",
    cornerBracket: "border-blue-400",
    medallionBorder: "border-blue-400/80",
    auraGlow: "from-blue-600/30 to-indigo-950/70",
    medallionGlow: "shadow-[0_0_25px_rgba(96,165,250,0.45),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-blue-500/35",
    textPrimary: "text-blue-200",
    textSecondary: "text-blue-300/90",
    badgeBg: "bg-blue-950/90",
    badgeBorder: "border-blue-400/40",
    foilGradient:
      "linear-gradient(135deg, #bfdbfe 0%, #ffffff 25%, #2563eb 50%, #93c5fd 75%, #1d4ed8 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(96,165,250,0.6) 0deg, rgba(192,132,252,0.6) 120deg, rgba(56,189,248,0.7) 240deg, rgba(96,165,250,0.6) 360deg)",
    textureType: "waves",
    textureOpacity: 0.05,
  },
  ULTRA_RARE: {
    borderOuter: "border-cyan-500/50",
    borderInner: "border-cyan-400/30",
    cornerBracket: "border-cyan-400",
    medallionBorder: "border-cyan-400/80",
    auraGlow: "from-cyan-600/30 to-blue-950/70",
    medallionGlow: "shadow-[0_0_25px_rgba(56,189,248,0.45),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-cyan-500/40",
    textPrimary: "text-cyan-200",
    textSecondary: "text-cyan-300/90",
    badgeBg: "bg-cyan-950/90",
    badgeBorder: "border-cyan-400/40",
    foilGradient:
      "linear-gradient(135deg, #cffaff 0%, #ffffff 25%, #0891b2 50%, #67e8f9 75%, #0e7490 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(56,189,248,0.6) 0deg, rgba(167,243,208,0.6) 120deg, rgba(192,132,252,0.7) 240deg, rgba(56,189,248,0.6) 360deg)",
    textureType: "dots",
    textureOpacity: 0.05,
  },
  EPIC: {
    borderOuter: "border-purple-500/50",
    borderInner: "border-purple-400/30",
    cornerBracket: "border-purple-400",
    medallionBorder: "border-purple-400/80",
    auraGlow: "from-purple-600/30 to-pink-950/70",
    medallionGlow: "shadow-[0_0_25px_rgba(192,132,252,0.5),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-purple-500/40",
    textPrimary: "text-purple-200",
    textSecondary: "text-purple-300/90",
    badgeBg: "bg-purple-950/90",
    badgeBorder: "border-purple-400/40",
    foilGradient:
      "linear-gradient(135deg, #f3e8ff 0%, #ffffff 25%, #9333ea 50%, #d8b4fe 75%, #6b21a8 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(192,132,252,0.6) 0deg, rgba(244,63,94,0.6) 120deg, rgba(56,189,248,0.7) 240deg, rgba(192,132,252,0.6) 360deg)",
    textureType: "diamonds",
    textureOpacity: 0.05,
  },
  LEGENDARY: {
    borderOuter: "border-amber-500/50",
    borderInner: "border-amber-400/30",
    cornerBracket: "border-amber-400",
    medallionBorder: "border-amber-400/80",
    auraGlow: "from-amber-600/30 to-yellow-950/70",
    medallionGlow: "shadow-[0_0_25px_rgba(251,191,36,0.5),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-amber-500/50",
    textPrimary: "text-amber-200",
    textSecondary: "text-amber-300/90",
    badgeBg: "bg-amber-950/90",
    badgeBorder: "border-amber-400/40",
    foilGradient:
      "linear-gradient(135deg, #fef08a 0%, #ffffff 25%, #d97706 50%, #fef3c7 75%, #78350f 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(251,191,36,0.6) 0deg, rgba(56,189,248,0.6) 120deg, rgba(192,132,252,0.6) 240deg, rgba(251,191,36,0.6) 360deg)",
    textureType: "shimmer",
    textureOpacity: 0.07,
  },
  MYTHIC: {
    borderOuter: "border-rose-500/50",
    borderInner: "border-rose-400/30",
    cornerBracket: "border-rose-400",
    medallionBorder: "border-rose-400/80",
    auraGlow: "from-rose-600/30 to-purple-950/70",
    medallionGlow: "shadow-[0_0_25px_rgba(244,63,94,0.55),inset_0_1px_2px_rgba(255,255,255,0.4)]",
    cardGlow: "shadow-rose-500/50",
    textPrimary: "text-rose-200",
    textSecondary: "text-rose-300/90",
    badgeBg: "bg-rose-950/90",
    badgeBorder: "border-rose-400/40",
    foilGradient:
      "linear-gradient(135deg, #ffe4e6 0%, #ffffff 25%, #e11d48 50%, #fda4af 75%, #881337 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(244,63,94,0.6) 0deg, rgba(251,191,36,0.6) 120deg, rgba(192,132,252,0.7) 240deg, rgba(244,63,94,0.6) 360deg)",
    textureType: "triangular",
    textureOpacity: 0.05,
  },
  DIVINE: {
    borderOuter: "border-yellow-400/60",
    borderInner: "border-amber-300/40",
    cornerBracket: "border-yellow-300",
    medallionBorder: "border-yellow-300/90",
    auraGlow: "from-yellow-400/35 to-amber-950/80",
    medallionGlow: "shadow-[0_0_30px_rgba(253,224,71,0.6),inset_0_1px_2px_rgba(255,255,255,0.5)]",
    cardGlow: "shadow-yellow-400/60",
    textPrimary: "text-yellow-200",
    textSecondary: "text-yellow-300/90",
    badgeBg: "bg-yellow-950/90",
    badgeBorder: "border-yellow-400/50",
    foilGradient:
      "linear-gradient(135deg, #fef9c3 0%, #ffffff 25%, #ca8a04 50%, #fef08a 75%, #713f12 100%)",
    foilDiffraction:
      "conic-gradient(from 0deg at 50% 50%, rgba(253,224,71,0.7) 0deg, rgba(255,255,255,0.8) 120deg, rgba(251,191,36,0.7) 240deg, rgba(253,224,71,0.7) 360deg)",
    textureType: "shimmer",
    textureOpacity: 0.09,
  },
};

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

/**
 * Official Ixnay Holographic Emblem Medallion (/apple-design)
 * Mouse/Movement Reactive 3D Metallic Foil Security Seal matching Rarity Theme
 */
const IxnayEmblem = React.memo(
  ({
    size = "md",
    pointer,
    theme,
  }: {
    size?: "sm" | "md" | "lg";
    pointer?: PointerState;
    theme?: RarityBackTheme;
  }) => {
    const iconSizeClass = size === "sm" ? "w-10 h-10" : size === "lg" ? "w-20 h-20" : "w-14 h-14";
    const logoUrl = useMemo(() => withBasePath("/images/ix-logo.svg?v=2"), []);
    const activeTheme = theme ?? RARITY_THEMES.COMMON!;

    // Pointer-driven motion physics
    const rotateAngle = pointer?.active ? pointer.x * 160 + pointer.y * 90 : 0;
    const glareX = pointer?.active ? `${pointer.x * 300}%` : "-150%";
    const glareOpacity = pointer?.active ? 0.95 : 0;

    return (
      <div
        className={cn("group relative flex items-center justify-center select-none", iconSizeClass)}
      >
        {/* Outer 3D Metallic Diamond Frame with Rarity Theme Border & Glow */}
        <div
          className={cn(
            "absolute inset-0 rotate-45 rounded-xl border-2 bg-slate-950/95 transition-all duration-300",
            activeTheme.medallionBorder,
            activeTheme.medallionGlow
          )}
        />
        <div className="absolute inset-1.5 -rotate-45 rounded-lg border border-white/40" />

        {/* Holographic Logo Container — Masked Strictly to Logo Vector Paths */}
        <div className="relative z-10 flex h-full w-full items-center justify-center p-2">
          <div
            className="pointer-events-none relative h-full w-full transition-transform duration-300 group-hover:scale-105"
            style={{
              WebkitMaskImage: `url('${logoUrl}')`,
              maskImage: `url('${logoUrl}')`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              filter:
                "drop-shadow(0 1px 0.5px rgba(255,255,255,0.7)) drop-shadow(0 -1px 0.5px rgba(0,0,0,0.8)) drop-shadow(0 3px 6px rgba(0,0,0,0.9))",
            }}
          >
            {/* 1. Metallic Rarity Theme Base Substrate */}
            <div
              className="absolute inset-0 transition-all duration-300"
              style={{
                backgroundImage: activeTheme.foilGradient,
              }}
            />

            {/* 2. Micro-Diffraction Grating Texture Lines */}
            <div
              className="absolute inset-0 opacity-40 mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 1.5px, rgba(255,255,255,0.6) 2px, rgba(0,0,0,0.2) 2.5px)",
              }}
            />

            {/* 3. Color-Dodge Prismatic Spectrum Shimmer (Pointer Movement Reactive) */}
            <motion.div
              className="absolute -inset-4 opacity-55 mix-blend-color-dodge"
              style={{
                backgroundImage: activeTheme.foilDiffraction,
                willChange: "transform",
              }}
              animate={{ rotate: rotateAngle }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />

            {/* 4. Sharp Specular Glare Beam Sweep (Pointer Position Reactive) */}
            <motion.div
              className="pointer-events-none absolute -inset-2 bg-gradient-to-r from-transparent via-white/95 to-transparent mix-blend-overlay"
              style={{ transform: "skewX(-35deg)", willChange: "transform" }}
              animate={{ x: glareX, opacity: glareOpacity }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
            />
          </div>
        </div>
      </div>
    );
  }
);
IxnayEmblem.displayName = "IxnayEmblem";

/**
 * Category Icon Badge Sub-Component
 */
const CategoryIconBadge = React.memo(
  ({
    catKey,
    size = "md",
    theme,
  }: {
    catKey: LoreCategory;
    size?: "sm" | "md";
    theme?: RarityBackTheme;
  }) => {
    const iconDef = CATEGORY_ICONS[catKey];
    const catTheme = useMemo(() => getCategoryTheme(catKey), [catKey]);

    const boxSize = size === "sm" ? "w-5.5 h-5.5 rounded-md" : "w-8 h-8 rounded-lg";
    const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5";

    return (
      <div
        className={cn(
          "flex items-center justify-center border backdrop-blur-xs transition-all",
          boxSize
        )}
        style={{
          borderColor: catTheme.accentColor,
          backgroundColor: catTheme.accentSoft,
          boxShadow: theme ? `0 0 10px ${catTheme.accentSoft}` : `0 0 8px ${catTheme.accentSoft}`,
        }}
        title={catTheme.label}
      >
        <svg className={iconSize} style={{ fill: catTheme.accentColor }} viewBox={iconDef.viewBox}>
          <path d={iconDef.path} />
        </svg>
      </div>
    );
  }
);
CategoryIconBadge.displayName = "CategoryIconBadge";

/**
 * Shared Header Sub-Component — Season + Rarity Badge Top Left, Edition Top Right
 */
const CardBackHeader = React.memo(
  ({
    season = 1,
    rarity,
    edition,
    theme,
    showRarity = true,
  }: {
    season?: number | string;
    rarity: string;
    edition: string;
    theme?: RarityBackTheme;
    showRarity?: boolean;
  }) => {
    const activeTheme = theme ?? RARITY_THEMES.COMMON!;

    return (
      <div className="flex w-full items-center justify-between font-mono text-[9px] font-semibold tracking-wider uppercase">
        {/* Top Left: Season + Rarity Badge matching Rarity Palette */}
        {showRarity ? (
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-bold tracking-wider backdrop-blur-xs transition-colors duration-300",
              activeTheme.badgeBg,
              activeTheme.badgeBorder,
              activeTheme.textPrimary
            )}
          >
            <span className="opacity-80">S{season}</span>
            <span className="opacity-40">·</span>
            <span>{rarity.replace("_", " ")}</span>
          </span>
        ) : (
          <span className={cn("transition-colors duration-300", activeTheme.textSecondary)}>
            IXCARDS
          </span>
        )}

        {/* Top Right: Edition Label */}
        <span
          className={cn("font-semibold transition-colors duration-300", activeTheme.textPrimary)}
        >
          {edition}
        </span>
      </div>
    );
  }
);
CardBackHeader.displayName = "CardBackHeader";

/**
 * Shared Footer Sub-Component
 */
const CardBackFooter = React.memo(
  ({ serial, cardName, theme }: { serial: string; cardName: string; theme?: RarityBackTheme }) => {
    const activeTheme = theme ?? RARITY_THEMES.COMMON!;

    return (
      <div
        className={cn(
          "flex w-full items-center justify-between border-t pt-1 font-mono text-[9px] transition-colors duration-300",
          activeTheme.borderOuter
        )}
      >
        <span
          className={cn(
            "font-bold tracking-wider transition-colors duration-300",
            activeTheme.textPrimary
          )}
        >
          #{serial}
        </span>
        <span className="max-w-[140px] truncate text-right font-sans text-[8.5px] font-bold tracking-wider text-white/60 uppercase">
          {cardName}
        </span>
      </div>
    );
  }
);
CardBackFooter.displayName = "CardBackFooter";

export const CardBack = React.memo<CardBackProps>(
  ({
    rarity = "COMMON",
    variant = "lattice",
    card,
    cardName,
    serialNumber,
    edition,
    className,
    performanceMode = false,
    showRarityVariation = true,
  }) => {
    const safeRarity = typeof rarity === "string" ? rarity.toUpperCase() : "COMMON";
    const pattern = getHolographicPattern(safeRarity as CardRarity);
    const lightRays = useMemo(() => generateLightRays(8), []);
    const rarityTheme = useMemo(
      () => RARITY_THEMES[safeRarity] ?? RARITY_THEMES.COMMON!,
      [safeRarity]
    );

    // Interactive Pointer Tracking (Mouse / Touch Reactive)
    const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0, active: false });

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setPointer({ x, y, active: true });
    }, []);

    const handlePointerLeave = useCallback(() => {
      setPointer({ x: 0, y: 0, active: false });
    }, []);

    const resolvedSeason = useMemo(() => card?.season || 1, [card]);
    const resolvedSerial = useMemo(
      () => serialNumber || (card ? getCardSerialNumber(card) : "00049281"),
      [serialNumber, card]
    );
    const resolvedEdition = useMemo(
      () => edition || (card ? getCardEditionLabel(card) : "1ST EDITION"),
      [edition, card]
    );
    const resolvedCardName = useMemo(() => cardName || card?.title || "IxCards", [cardName, card]);

    // Pointer-reactive background shimmer calculations
    const shimmerX = pointer.active ? 50 + pointer.x * 50 : 50;
    const shimmerY = pointer.active ? 50 + pointer.y * 50 : 50;
    const spotlightX = `${((pointer.x + 1) / 2) * 100}%`;
    const spotlightY = `${((pointer.y + 1) / 2) * 100}%`;
    const glanceShift = pointer.active ? `${pointer.x * 200}%` : "-100%";

    return (
      <div
        onPointerMove={!performanceMode ? handlePointerMove : undefined}
        onPointerLeave={!performanceMode ? handlePointerLeave : undefined}
        className={cn(
          "relative flex h-full min-h-full w-full min-w-full flex-col justify-between overflow-hidden rounded-3xl p-3.5 select-none",
          "border-2 bg-slate-950 shadow-2xl transition-all duration-300",
          rarityTheme.borderOuter,
          rarityTheme.cardGlow,
          className
        )}
      >
        {/* Layer 1: Dark Obsidian Deep Base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#090d16_0%,#020408_100%)]" />

        {/* Layer 2: Rarity Dynamic Aura Glow matching Front Face */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-25 transition-opacity duration-300",
            rarityTheme.auraGlow
          )}
        />

        {/* Layer 2b: Tactile Physical Texture Overlay */}
        <TextureOverlay
          texture={rarityTheme.textureType}
          opacity={rarityTheme.textureOpacity}
          className="pointer-events-none z-0 mix-blend-overlay"
        />

        {/* Layer 3: Dynamic Pointer-Centered Light Rays */}
        {!performanceMode && pointer.active && (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-40">
            {lightRays.slice(0, 6).map((ray, index) => (
              <div
                key={index}
                className="absolute w-1 origin-left bg-gradient-to-r from-white/60 to-transparent"
                style={{
                  left: spotlightX,
                  top: spotlightY,
                  height: `${ray.length}%`,
                  transform: `rotate(${ray.angle}deg)`,
                }}
              />
            ))}
          </div>
        )}

        {/* Layer 4: Holographic Rainbow Shimmer Overlay (Pointer Position Reactive) */}
        {!performanceMode && (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-color-dodge transition-opacity duration-300 ease-out"
            style={{
              backgroundImage:
                pattern === "rainbow-shimmer"
                  ? getRainbowHolographicGradient(45, true)
                  : pattern === "cosmic"
                    ? "radial-gradient(circle at 50% 50%, rgba(147,51,234,0.4), rgba(236,72,153,0.3), rgba(59,130,246,0.2))"
                    : getMetallicGradient("silver"),
              backgroundSize: "200% 200%",
              backgroundPosition: `${shimmerX}% ${shimmerY}%`,
              opacity: pointer.active ? 0.6 : 0,
            }}
          />
        )}

        {/* Layer 4b: Specular Cursor Spotlight — centered directly on cursor */}
        {!performanceMode && pointer.active && (
          <div
            className="pointer-events-none absolute inset-0 z-10 mix-blend-overlay transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 140px at ${spotlightX} ${spotlightY}, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.15) 45%, transparent 80%)`,
            }}
          />
        )}

        {/* Layer 5: Double Outer Filigree Border Frame matching Rarity Palette */}
        <div
          className={cn(
            "pointer-events-none absolute inset-2 rounded-2xl border transition-colors duration-300",
            rarityTheme.borderOuter
          )}
        >
          <div
            className={cn(
              "absolute inset-1 rounded-xl border transition-colors duration-300",
              rarityTheme.borderInner
            )}
          />
          <div
            className={cn(
              "absolute top-1 left-1 h-3 w-3 border-t-2 border-l-2 transition-colors duration-300",
              rarityTheme.cornerBracket
            )}
          />
          <div
            className={cn(
              "absolute top-1 right-1 h-3 w-3 border-t-2 border-r-2 transition-colors duration-300",
              rarityTheme.cornerBracket
            )}
          />
          <div
            className={cn(
              "absolute bottom-1 left-1 h-3 w-3 border-b-2 border-l-2 transition-colors duration-300",
              rarityTheme.cornerBracket
            )}
          />
          <div
            className={cn(
              "absolute right-1 bottom-1 h-3 w-3 border-r-2 border-b-2 transition-colors duration-300",
              rarityTheme.cornerBracket
            )}
          />
        </div>

        {/* ─── VARIANT 1: GUILLOCHE ICON LATTICE GRID (DEFAULT) ─── */}
        {variant === "lattice" && (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-between p-2">
            <CardBackHeader
              season={resolvedSeason}
              rarity={safeRarity}
              edition={resolvedEdition}
              theme={rarityTheme}
              showRarity={showRarityVariation}
            />

            {/* 3x4 Guilloche Pattern Grid of Colored Category Icons */}
            <div className="pointer-events-none absolute inset-x-3 top-8 bottom-8 grid grid-cols-3 grid-rows-4 items-center justify-items-center gap-2 opacity-85">
              {ALL_CATEGORY_KEYS.map((catKey) => (
                <CategoryIconBadge key={catKey} catKey={catKey} size="md" theme={rarityTheme} />
              ))}
            </div>

            {/* Central Ixnay Badge Overlay with Main Holographic Seal */}
            <div
              className={cn(
                "relative my-auto flex flex-col items-center justify-center rounded-2xl border-2 bg-black/95 px-6 py-4 backdrop-blur-xl transition-all duration-300",
                rarityTheme.medallionBorder,
                rarityTheme.medallionGlow
              )}
            >
              <IxnayEmblem size="lg" pointer={pointer} theme={rarityTheme} />
              <div
                className={cn(
                  "mt-2 text-xs font-bold tracking-widest uppercase transition-colors duration-300",
                  rarityTheme.textPrimary
                )}
              >
                IXCARDS
              </div>
            </div>

            <CardBackFooter
              serial={resolvedSerial}
              cardName={resolvedCardName}
              theme={rarityTheme}
            />
          </div>
        )}

        {/* ─── VARIANT 2: ZODIAC RING & SWIRL CREST ─── */}
        {variant === "zodiac" && (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-between p-2">
            <CardBackHeader
              season={resolvedSeason}
              rarity={safeRarity}
              edition={resolvedEdition}
              theme={rarityTheme}
              showRarity={showRarityVariation}
            />

            <div className="relative my-auto flex aspect-square w-full max-w-[220px] items-center justify-center">
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-full border transition-colors duration-300",
                  rarityTheme.borderInner,
                  rarityTheme.medallionGlow
                )}
                animate={{ rotate: pointer.active ? pointer.x * 90 : 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 20 }}
              />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {ALL_CATEGORY_KEYS.map((catKey, idx) => {
                  const angleRad = (idx * 30 * Math.PI) / 180;
                  const x = Math.cos(angleRad) * 80;
                  const y = Math.sin(angleRad) * 80;
                  return (
                    <div
                      key={catKey}
                      className="absolute"
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                    >
                      <CategoryIconBadge catKey={catKey} size="sm" theme={rarityTheme} />
                    </div>
                  );
                })}
              </div>

              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-full border-2 bg-black/90 p-4 backdrop-blur-md transition-all duration-300",
                  rarityTheme.medallionBorder,
                  rarityTheme.medallionGlow
                )}
              >
                <IxnayEmblem size="md" pointer={pointer} theme={rarityTheme} />
                <span
                  className={cn(
                    "mt-1 text-[10px] font-bold tracking-widest uppercase transition-colors duration-300",
                    rarityTheme.textPrimary
                  )}
                >
                  IXCARDS
                </span>
              </div>
            </div>

            <CardBackFooter
              serial={resolvedSerial}
              cardName={resolvedCardName}
              theme={rarityTheme}
            />
          </div>
        )}

        {/* ─── VARIANT 3: TWIN CATEGORY RUNE COLUMNS ─── */}
        {variant === "runes" && (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-between p-2">
            <CardBackHeader
              season={resolvedSeason}
              rarity={safeRarity}
              edition={resolvedEdition}
              theme={rarityTheme}
              showRarity={showRarityVariation}
            />

            <div className="relative my-1 flex w-full flex-1 items-center justify-between px-1">
              <div className="flex h-full flex-col justify-between space-y-1 py-2">
                {ALL_CATEGORY_KEYS.slice(0, 6).map((catKey) => (
                  <CategoryIconBadge key={catKey} catKey={catKey} size="sm" theme={rarityTheme} />
                ))}
              </div>

              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-2xl border-2 bg-black/90 p-4 backdrop-blur-md transition-all duration-300",
                  rarityTheme.medallionBorder,
                  rarityTheme.medallionGlow
                )}
              >
                <IxnayEmblem size="lg" pointer={pointer} theme={rarityTheme} />
                <span
                  className={cn(
                    "mt-2 text-xs font-bold tracking-widest uppercase transition-colors duration-300",
                    rarityTheme.textPrimary
                  )}
                >
                  IXCARDS
                </span>
              </div>

              <div className="flex h-full flex-col justify-between space-y-1 py-2">
                {ALL_CATEGORY_KEYS.slice(6, 12).map((catKey) => (
                  <CategoryIconBadge key={catKey} catKey={catKey} size="sm" theme={rarityTheme} />
                ))}
              </div>
            </div>

            <CardBackFooter
              serial={resolvedSerial}
              cardName={resolvedCardName}
              theme={rarityTheme}
            />
          </div>
        )}

        {/* Diagonal Light Shimmer Sweep (Pointer Position Reactive) */}
        {!performanceMode && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            style={{ transform: "skewX(-20deg)", willChange: "transform" }}
            animate={{ x: glanceShift, opacity: pointer.active ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        )}
      </div>
    );
  }
);

CardBack.displayName = "CardBack";
