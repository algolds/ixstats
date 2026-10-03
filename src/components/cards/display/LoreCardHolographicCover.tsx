"use client";

import "~/styles/card-art.css";

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

import React, { useMemo } from "react";
import { cn } from "~/lib/utils";
import { getFoilStampConfig } from "~/lib/themes";
import {
  getCoverHoloOpacity,
  getEffectiveRarity,
  getHoloGradient,
  useHoverMousePos,
} from "./holo-helpers";

// ─── Types ──────────────────────────────────────────────────────

interface LoreCardHolographicCoverProps {
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

// ─── Component ──────────────────────────────────────────────────

export const LoreCardHolographicCover = React.memo<LoreCardHolographicCoverProps>(
  ({ rarity: rarityStr, wikiSource, title: _title, isHovered = false, className }) => {
    const { containerRef, mousePos } = useHoverMousePos(isHovered);

    const themeKey =
      wikiSource === "ixwiki" ? "ixwiki" : wikiSource === "iiwiki" ? "iiwiki" : "default";
    const theme = LORE_THEMES[themeKey]!;
    const rarity = getEffectiveRarity(rarityStr);
    const foilStamp = getFoilStampConfig(rarity);
    const holoOpacity = getCoverHoloOpacity(rarity, isHovered);
    const holoGradient = useMemo(() => getHoloGradient(rarity), [rarity]);

    const showMotifs = rarity !== "COMMON";

    return (
      <div
        ref={containerRef}
        className={cn("absolute inset-0 overflow-hidden select-none", className)}
      >
        {/* Layer 1: Base gradient */}
        <div className={cn("card-art-linear-br absolute inset-0", theme.base)} />

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
              className="pack-geo-spin rounded-control absolute border"
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
                className="text-title-2 absolute flex items-center justify-center opacity-40"
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
            <p className="text-footnote font-semibold tracking-[0.25em] text-white/25 uppercase">
              {theme.label}
            </p>
            <p className="text-footnote tracking-[0.2em] text-white/15 uppercase">
              Historical archive
            </p>
          </div>
        </div>
      </div>
    );
  }
);

LoreCardHolographicCover.displayName = "LoreCardHolographicCover";
