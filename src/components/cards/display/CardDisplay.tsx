/**
 * CardDisplay Component - PREMIUM EDITION
 * Yu-Gi-Oh style digital trading card with holographic effects
 * Phase 1.5: Premium UI/UX Refactor with Glass Physics
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { CometCard } from "~/components/ui/comet-card";
import { RarityBadge } from "./RarityBadge";
import { HolographicOverlay } from "./HolographicOverlay";
import {
  getRarityGlow,
  getRarityConfig,
  getCardWidth,
  formatCardStats,
  getCardTypeLabel,
} from "~/lib/cards/display-utils";
import { getPremiumBorderConfig, getFoilStampConfig, getMetallicGradient } from "~/lib/themes";
import { proxyNSImage } from "~/lib/cards/ns-image-proxy";
import { CardHolographicCover } from "./CardHolographicCover";
import { RARITY_THEMES } from "./CardBack";
import { NationStatesBadge } from "./NationStatesLogo";
import { IIWikiBadge, isIIWikiCard } from "./IIWikiLogo";
import { CategoryIcon } from "~/components/cards/icons";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { getCategoryTheme, getCategoryLabel } from "~/lib/cards/category-theme";
import { isValidLoreCategory, type LoreCategory } from "~/lib/cards/category-enums";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { getHybridRarityMaterial } from "~/lib/cards/rarity-materials";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";
import { getCardDesignMetadata } from "~/lib/cards/card-metadata-resolver";

// Static lookup configurations hoisted outside render function
const FONT_SIZES = {
  small: {
    title: "text-xs",
    type: "text-[10px]",
    stats: "text-[10px]",
  },
  sm: {
    title: "text-xs",
    type: "text-[10px]",
    stats: "text-[10px]",
  },
  medium: {
    title: "text-sm",
    type: "text-xs",
    stats: "text-xs",
  },
  md: {
    title: "text-sm",
    type: "text-xs",
    stats: "text-xs",
  },
  large: {
    title: "text-base",
    type: "text-sm",
    stats: "text-sm",
  },
} as const;

const HEIGHT_CLASSES: Record<CardDisplaySize, string> = {
  small: "h-[179px]",
  sm: "h-[179px]",
  medium: "h-[269px]",
  md: "h-[269px]",
  large: "h-[358px]",
};

const HEIGHT_PIXELS: Record<CardDisplaySize, string> = {
  small: "179px",
  sm: "179px",
  medium: "269px",
  md: "269px",
  large: "358px",
};

/**
 * CardDisplay component props
 */
export interface CardDisplayProps {
  /** Card instance data */
  card: CardInstance;
  /** Display size variant */
  size?: CardDisplaySize;
  /** Click handler */
  onClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show stats on hover (default: true) */
  showStatsOnHover?: boolean;
  /** Enable 3D tilt effect (default: true) */
  enable3D?: boolean;
  /** Enable holographic effects (default: true for rare+) */
  enableHolographic?: boolean;
  /** Performance mode - disable heavy effects */
  performanceMode?: boolean;
  /** Hide market value (default: false) */
  hideValue?: boolean;
  /** Hide stats bars & hover stats (default: false) */
  hideStats?: boolean;
  /** Hide bottom lore excerpt box (default: false) */
  hideExcerpt?: boolean;
}

export const CardDisplay = React.memo<CardDisplayProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    showStatsOnHover = true,
    enable3D = true,
    enableHolographic,
    performanceMode = false,
    hideValue: _hideValue = false,
    hideStats = false,
    hideExcerpt = false,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);

    const designMeta = React.useMemo(() => getCardDesignMetadata(card), [card]);
    const rarityConfig = React.useMemo(() => getRarityConfig(card.rarity), [card.rarity]);
    const stats = React.useMemo(() => formatCardStats(card), [card]);
    const borderConfig = React.useMemo(() => getPremiumBorderConfig(card.rarity), [card.rarity]);
    const foilStamp = React.useMemo(() => getFoilStampConfig(card.rarity), [card.rarity]);

    // Resolve category and theme (memoized)
    const resolvedCategory: LoreCategory | null = React.useMemo(() => {
      if (card.category && isValidLoreCategory(card.category)) {
        return card.category as LoreCategory;
      }
      if (isValidLoreCategory(card.cardType)) {
        return card.cardType as LoreCategory;
      }
      return null;
    }, [card.category, card.cardType]);

    // Check if artwork URL is custom art (Tier 3) or legacy artwork
    const customArtUrl = card.artworkUrl || card.artwork || card.wikiImageUrl;
    const hasCustomArtwork = Boolean(customArtUrl && customArtUrl.trim() !== "" && !imageError);

    const cardTypeStr = (card.cardType as string) || "";
    // Is this a lore card (no numeric stats)?
    const isLoreCard =
      cardTypeStr === "LORE" ||
      cardTypeStr === "LORE_BATCH" ||
      Boolean(card.category && card.category !== "NS_IMPORT") ||
      Boolean(card.wikiPageId) ||
      Boolean(card.wikiSource) ||
      Boolean(card.wikiArticleTitle) ||
      Boolean(card.slug) ||
      (resolvedCategory !== null && resolvedCategory !== "NS_IMPORT");

    const effectiveCategory: LoreCategory | null = React.useMemo(() => {
      if (resolvedCategory && resolvedCategory !== "NS_IMPORT") {
        return resolvedCategory;
      }
      if (isLoreCard) {
        const meta = card.metadata as Record<string, unknown> | null | undefined;
        return classifyFromWikitext(
          (meta?.fullExcerpt as string) || card.description,
          card.wikiArticleTitle || card.title
        );
      }
      return null;
    }, [
      resolvedCategory,
      isLoreCard,
      card.metadata,
      card.description,
      card.wikiArticleTitle,
      card.title,
    ]);

    const effectiveCategoryTheme = React.useMemo(
      () => (effectiveCategory ? getCategoryTheme(effectiveCategory) : null),
      [effectiveCategory]
    );

    const isIIWiki = React.useMemo(() => isIIWikiCard(card), [card]);

    const rarityMat = React.useMemo(
      () => getHybridRarityMaterial(card.rarity, effectiveCategory, designMeta.enableCategoryTint),
      [card.rarity, effectiveCategory, designMeta.enableCategoryTint]
    );

    const rarityTheme = React.useMemo(
      () => RARITY_THEMES[card.rarity] ?? RARITY_THEMES.COMMON!,
      [card.rarity]
    );

    const excerptText = card.wikiExcerpt || card.description || "";
    const parsedExcerptHtml = React.useMemo(
      () => (excerptText ? parseWikitextToHtml(excerptText) : ""),
      [excerptText]
    );

    // Auto-enable holographic for rare+ cards unless explicitly disabled
    const shouldShowHolographic =
      enableHolographic !== false &&
      !performanceMode &&
      ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"].includes(card.rarity);

    // Size-dependent classes
    const widthClass = getCardWidth(size);
    const fonts = FONT_SIZES[size] || FONT_SIZES.medium;
    const heightClass = HEIGHT_CLASSES[size] || HEIGHT_CLASSES.medium;

    const handleClick = () => {
      if (onClick) {
        onClick(card);
      }
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    const borderImageSourceStyle = React.useMemo(() => {
      if (!borderConfig.animated || performanceMode) return undefined;
      return `linear-gradient(135deg, ${borderConfig.gradient
        .split(" ")
        .map((c) => `var(--tw-gradient-${c})`)
        .join(", ")})`;
    }, [borderConfig, performanceMode]);

    return (
      <CometCard
        className={cn(
          widthClass,
          heightClass,
          onClick && "cursor-pointer",
          "transition-all duration-300",
          className
        )}
        rotateDepth={enable3D && !performanceMode ? 12 : 0}
        translateDepth={enable3D && !performanceMode ? 15 : 0}
        holographic={shouldShowHolographic}
        holographicIntensity={0.7}
        glassDepth="child"
        disableEffects={performanceMode}
      >
        <motion.div
          className={cn(
            "relative h-full w-full overflow-hidden rounded-2xl",
            borderConfig.animated && !performanceMode
              ? `border-${borderConfig.width} ${borderConfig.glow}`
              : `border-${borderConfig.width}`,
            rarityConfig.borderColor
          )}
          style={{
            borderImageSource: borderImageSourceStyle,
            borderImageSlice: borderConfig.animated && !performanceMode ? 1 : undefined,
            boxShadow: `0 20px 45px -10px rgba(0, 0, 0, 0.85), 0 0 25px ${rarityMat.specularColor}`,
          }}
          onHoverStart={handleMouseEnter}
          onHoverEnd={handleMouseLeave}
          onClick={handleClick}
          whileHover={
            !performanceMode
              ? {
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }
              : undefined
          }
        >
          {/* Dual-Border Frame & Corner Brackets (matching CardBack.tsx) */}
          <div
            className={cn(
              "pointer-events-none absolute inset-1 z-30 rounded-[14px] border opacity-60",
              rarityTheme.borderInner
            )}
          />

          <div
            className={cn(
              "pointer-events-none absolute top-1.5 left-1.5 z-30 h-3 w-3 border-t-2 border-l-2 opacity-85",
              rarityTheme.cornerBracket
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute top-1.5 right-1.5 z-30 h-3 w-3 border-t-2 border-r-2 opacity-85",
              rarityTheme.cornerBracket
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute bottom-1.5 left-1.5 z-30 h-3 w-3 border-b-2 border-l-2 opacity-85",
              rarityTheme.cornerBracket
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute right-1.5 bottom-1.5 z-30 h-3 w-3 border-r-2 border-b-2 opacity-85",
              rarityTheme.cornerBracket
            )}
          />
          {/* Card artwork / procedural background */}
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              height: HEIGHT_PIXELS[size] || "269px",
            }}
          >
            {hasCustomArtwork && customArtUrl ? (
              <Image
                src={proxyNSImage(customArtUrl)}
                alt={card.title}
                fill
                className="object-cover"
                loading="lazy"
                sizes={
                  size === "small" || size === "sm"
                    ? "128px"
                    : size === "medium" || size === "md"
                      ? "192px"
                      : "256px"
                }
                onError={() => setImageError(true)}
                unoptimized
              />
            ) : (
              <CardHolographicCover
                category={resolvedCategory}
                cardType={card.cardType}
                rarity={card.rarity}
                wikiSource={isIIWiki ? "iiwiki" : card.wikiSource}
                title={card.title}
                designMetadata={designMeta}
                isHovered={isHovered}
              />
            )}

            {/* Metallic gradient overlay for premium feel */}
            {!performanceMode && (
              <div
                className="absolute inset-0 opacity-10 mix-blend-overlay"
                style={{
                  background: getMetallicGradient(
                    card.rarity === "LEGENDARY"
                      ? "gold"
                      : card.rarity === "EPIC"
                        ? "purple"
                        : "silver"
                  ),
                }}
              />
            )}

            {/* Tactile Texture Overlay for Physical Cardstock Depth */}
            <TextureOverlay
              texture="paperGrain"
              opacity={0.06}
              className="pointer-events-none z-10 mix-blend-overlay"
            />

            {/* Gradient overlay for text readability when using artwork */}
            {hasCustomArtwork && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            )}

            {/* Holographic overlay layer */}
            {shouldShowHolographic && (
              <HolographicOverlay
                rarity={card.rarity}
                enableMouseTracking={!performanceMode}
                enableLightRays={!performanceMode}
                enableFoilStamp={foilStamp.enabled && !performanceMode}
                enableParticles={!performanceMode}
                disabled={performanceMode}
              />
            )}

            {/* Rarity glow effect */}
            <motion.div
              className={cn("absolute inset-0 rounded-2xl", getRarityGlow(card.rarity))}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 0.5 : 0.2 }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Card content overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
            {/* Top section - Rarity badge & category seal */}
            <div className="flex items-start justify-between">
              <RarityBadge
                rarity={card.rarity}
                season={card.season}
                size={size === "large" ? "medium" : "small"}
                animated={!performanceMode}
              />
              <div className="flex items-center gap-1">
                {isIIWiki ? (
                  <IIWikiBadge size="sm" showText={false} className="h-5 w-auto px-1 py-0" />
                ) : !isLoreCard && (card.cardType === "NS_IMPORT" || Boolean(card.nsCardId)) ? (
                  <NationStatesBadge />
                ) : null}

                {effectiveCategory ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-md border border-white/20 bg-slate-950/80 p-0.5 text-white shadow-xs backdrop-blur-md"
                    title={getCategoryLabel(effectiveCategory)}
                  >
                    <CategoryIcon
                      category={effectiveCategory}
                      treatment="seal"
                      size="xs"
                      color={effectiveCategoryTheme?.accentColor}
                    />
                  </span>
                ) : !isIIWiki &&
                  (isLoreCard || (card.cardType !== "NS_IMPORT" && !card.nsCardId)) ? (
                  <span
                    className={cn(
                      "rounded-md border border-white/20 bg-slate-950/80 px-2 py-0.5 font-bold text-white shadow-xs backdrop-blur-md",
                      fonts.type
                    )}
                  >
                    {getCardTypeLabel(card.cardType)}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Bottom section - Card info */}
            <div className="space-y-1">
              {/* Card title */}
              <motion.h3
                className={cn("line-clamp-2 font-bold tracking-tight text-white", fonts.title)}
                style={{
                  textShadow: "0 2px 6px rgba(0, 0, 0, 0.9)",
                }}
                animate={
                  !performanceMode && isHovered
                    ? {
                        scale: [1, 1.02, 1],
                      }
                    : {}
                }
                transition={{ duration: 0.4 }}
              >
                {card.title}
              </motion.h3>

              {/* Subtitle line */}
              <p className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-white/80 uppercase">
                <span>
                  {card.subcategory ||
                    (effectiveCategory ? getCategoryLabel(effectiveCategory) : "Chronicles")}
                </span>
                <span className="text-white/40">•</span>
                <span className="font-semibold tracking-wide text-amber-400">
                  {designMeta.customSubtitle || card.rarity}
                </span>
              </p>

              {/* Country name (if available) */}
              {card.country && (
                <p
                  className={cn("font-semibold text-white/90", fonts.type)}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  {card.country.name}
                </p>
              )}

              {/* Stat bars — ONLY for nation/NS_IMPORT cards (numeric stats are dropped for lore categories) */}
              {!hideStats && !isLoreCard && Object.keys(stats.base).length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 backdrop-blur-md">
                    {Object.entries(stats.base).map(([key, stat]) => (
                      <div key={key} className="flex-1 space-y-0.5">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${stat.value}%`,
                              backgroundColor: stat.def.color,
                            }}
                          />
                        </div>
                        <div className="text-center text-[7px] leading-none font-bold text-white/50">
                          {stat.def.label.substring(0, 3).toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Lore Excerpt Box */}
              {isLoreCard && !hideExcerpt && (excerptText || parsedExcerptHtml) && (
                <div className="pointer-events-auto mt-1 rounded-xl border border-white/15 bg-slate-950/85 p-2 text-left shadow-inner backdrop-blur-md transition-all duration-300">
                  <div className="line-clamp-2 text-[10px] leading-snug text-white/90">
                    <WikiHtmlContent html={parsedExcerptHtml} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-[8px] text-white/50">
                    <span className="font-semibold tracking-wider text-amber-400 uppercase">
                      {(card.wikiSource || "IXWIKI").toUpperCase()} ARCHIVE
                    </span>
                    <span className="flex items-center gap-0.5 font-mono font-bold text-white/70 tabular-nums">
                      <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                      {card.marketValue.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Premium stats reveal on hover for non-lore cards */}
              <AnimatePresence>
                {!hideStats && !isLoreCard && showStatsOnHover && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "xs:grid-cols-2 grid grid-cols-1 gap-1 rounded-lg p-2",
                      "border border-white/20 bg-black/80 backdrop-blur-xl",
                      fonts.stats
                    )}
                    style={{
                      boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                    }}
                  >
                    {Object.entries(stats.base).map(([key, stat]) => (
                      <div key={key} className="flex items-center justify-between px-1">
                        <span className="font-medium text-white/70">{stat.def.label}</span>
                        <span
                          className="font-bold tabular-nums"
                          style={{
                            color: stat.def.color,
                            textShadow: `0 0 8px ${stat.def.color}`,
                          }}
                        >
                          {stat.value}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Level indicator */}
          {card.level > 1 && (
            <motion.div
              className={cn(
                "absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full",
                "bg-gradient-to-br from-amber-400 to-amber-600",
                "text-sm font-bold text-black tabular-nums",
                "border-2 border-amber-300",
                "shadow-lg shadow-amber-500/50"
              )}
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: 1,
                rotate: 0,
              }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              {card.level}
            </motion.div>
          )}
        </motion.div>
      </CometCard>
    );
  }
);

CardDisplay.displayName = "CardDisplay";
