"use client";

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

// ─── Types ──────────────────────────────────────────────────────

export interface LoreCardHolographicCoverProps {
  rarity: string;
  wikiSource?: string | null;
  title?: string;
  isHovered?: boolean;
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

export const LoreCardHolographicCover = React.memo<LoreCardHolographicCoverProps>(
  ({ rarity: rarityStr, wikiSource, title: _title, isHovered = false, className }) => {
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

    const themeKey =
      wikiSource === "ixwiki" ? "ixwiki" : wikiSource === "iiwiki" ? "iiwiki" : "default";
    const theme = LORE_THEMES[themeKey]!;
    const rarity = getEffectiveRarity(rarityStr);
    const foilStamp = getFoilStampConfig(rarity);
    const holoOpacity = isHovered ? getHoloOpacity(rarity) : getHoloOpacity(rarity) * 0.4;
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    const showMotifs = rarity !== "COMMON";

    return (
      <div
        ref={containerRef}
        className={cn("absolute inset-0 overflow-hidden select-none", className)}
      >
        {/* Layer 1: Base gradient */}
        <div className={cn("absolute inset-0 bg-gradient-to-br", theme.base)} />

        {/* Layer 2: Ink-flow pattern */}
        <div
          className="lore-ink-flow absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, ${theme.accent} 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, ${theme.accentSoft} 0%, transparent 50%)
            `,
            backgroundSize: "200% 200%",
            animation: isHovered ? "lore-ink-flow 12s ease-in-out infinite" : "none",
            opacity: 0.6,
          }}
        />

        {/* Layer 3: Holographic pattern */}
        <div
          className="pack-holo-drift absolute inset-0"
          style={{
            backgroundImage: holoGradient,
            backgroundSize: "400% 400%",
            backgroundPosition:
              // oxlint-disable-next-line
              isHovered && containerRef.current
                ? // oxlint-disable-next-line
                  `${(mousePos.x / (containerRef.current.offsetWidth || 1)) * 100}% ${(mousePos.y / (containerRef.current.offsetHeight || 1)) * 100}%`
                : "50% 50%",
            mixBlendMode: "overlay",
            opacity: holoOpacity,
            filter: theme.hueRotate ? `hue-rotate(${theme.hueRotate}deg)` : undefined,
            transition: "background-position 0.1s ease-out",
          }}
        />

        {/* Layer 4: Scroll / archive motifs */}
        {showMotifs && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* Outer scroll frame */}
            <div
              className="pack-geo-spin absolute rounded-lg border"
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
              className="pack-geo-spin absolute"
              style={{
                width: "35%",
                height: "35%",
                border: `1px solid ${theme.accentSoft}`,
                background: theme.accentSoft,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                animation: isHovered ? "geo-spin 35s linear infinite reverse" : "none",
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

        {/* Layer 5: Specular Spotlight & Pointer-driven Foil Glare Sweep */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 140px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.12) 40%, transparent 80%)`,
            }}
          />
        )}

        {/* Layer 6: "Historical Archive" label at center */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="space-y-1 px-4 text-center">
            <p className="text-[9px] font-semibold tracking-[0.25em] text-white/25 uppercase">
              {theme.label}
            </p>
            <p className="text-[8px] tracking-[0.2em] text-white/15 uppercase">
              Historical Archive
            </p>
          </div>
        </div>
      </div>
    );
  }
);

LoreCardHolographicCover.displayName = "LoreCardHolographicCover";
