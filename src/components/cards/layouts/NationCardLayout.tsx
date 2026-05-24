/**
 * NationCardLayout Component
 * Specialized layout for Nation-type trading cards
 *
 * Features:
 * - Flag prominence (top-left overlay on artwork)
 * - Country stats focus (population, GDP, government)
 * - Government type badge
 * - Economy tier display
 * - Glass physics design integration
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { CometCard } from "~/components/ui/comet-card";
import { RarityBadge } from "../display/RarityBadge";
import { HolographicOverlay } from "../display/HolographicOverlay";
import {
  getRarityGlow,
  getRarityConfig,
  getCardWidth,
  formatMarketValue,
  getCardTypeLabel,
} from "~/lib/card-display-utils";
import {
  getPremiumBorderConfig,
  getFoilStampConfig,
  getEmbossedTextShadow,
  getMetallicGradient,
} from "~/lib/holographic-effects";
import { proxyNSImage } from "~/lib/ns-image-proxy";
import { useSoundService } from "~/lib/sound-service";
import { CardHolographicCover } from "../display/CardHolographicCover";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

/**
 * NationCardLayout component props
 */
export interface NationCardLayoutProps {
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
}

/**
 * NationCardLayout - Specialized layout for Nation cards
 *
 * Features flag prominence, government/economy stats, and nation-specific styling
 *
 * @example
 * ```tsx
 * <NationCardLayout
 *   card={nationCard}
 *   size="medium"
 *   onClick={(card) => console.log('Clicked:', card.title)}
 * />
 * ```
 */
export const NationCardLayout = React.memo<NationCardLayoutProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    showStatsOnHover = true,
    enable3D = true,
    enableHolographic,
    performanceMode = false,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);
    const soundService = useSoundService();

    const rarityConfig = getRarityConfig(card.rarity);
    const borderConfig = getPremiumBorderConfig(card.rarity);
    const foilStamp = getFoilStampConfig(card.rarity);

    // Auto-enable holographic for rare+ cards unless explicitly disabled
    const shouldShowHolographic =
      enableHolographic !== false &&
      !performanceMode &&
      ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"].includes(card.rarity);

    // Size-dependent classes
    const widthClass = getCardWidth(size);

    // Font sizes based on card size
    const fontSizes = {
      small: { title: "text-xs", type: "text-[10px]", stats: "text-[10px]" },
      sm: { title: "text-xs", type: "text-[10px]", stats: "text-[10px]" },
      medium: { title: "text-sm", type: "text-xs", stats: "text-xs" },
      md: { title: "text-sm", type: "text-xs", stats: "text-xs" },
      large: { title: "text-base", type: "text-sm", stats: "text-sm" },
    };

    const fonts = fontSizes[size];

    // Extract nation-specific metadata
    const nationStats = (card.stats as Record<string, any>) || {};
    const governmentType = nationStats.governmentType || "Unknown";
    const economyTier = nationStats.economyTier || "N/A";
    const population = nationStats.population || 0;
    const gdp = nationStats.gdp || 0;

    /**
     * Handle card click
     */
    const handleClick = () => {
      soundService?.play("card-select");
      if (onClick) {
        onClick(card);
      }
    };

    /**
     * Handle card hover
     */
    const handleMouseEnter = () => {
      setIsHovered(true);
      soundService?.play("card-hover", 0.3);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    // Explicit height to ensure proper aspect ratio rendering
    const heightClass =
      size === "small" || size === "sm"
        ? "h-[179px]"
        : size === "medium" || size === "md"
          ? "h-[269px]"
          : "h-[358px]";

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
          onHoverStart={handleMouseEnter}
          onHoverEnd={handleMouseLeave}
          onClick={handleClick}
          whileHover={!performanceMode ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
        >
          {/* Card artwork */}
          <div
            className="relative w-full"
            style={{
              height:
                size === "small" || size === "sm"
                  ? "179px"
                  : size === "medium" || size === "md"
                    ? "269px"
                    : "358px",
            }}
          >
            {!imageError ? (
              <Image
                src={proxyNSImage(card.artwork)}
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
                cardType={card.cardType}
                rarity={card.rarity}
                title={card.title}
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

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

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

            {/* FLAG PROMINENT OVERLAY - Top-left corner */}
            {card.country?.flag && (
              <motion.div
                className="absolute top-3 left-3 z-10"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative h-12 w-16 overflow-hidden rounded-md border-2 border-white/50 shadow-lg">
                  <Image
                    src={card.country.flag}
                    alt={`${card.country.name} flag`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent mix-blend-overlay" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Card content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-3">
            {/* Top section - Rarity badge & type */}
            <div className="flex items-start justify-between">
              <RarityBadge
                rarity={card.rarity}
                size={size === "large" ? "medium" : "small"}
                animated={!performanceMode}
              />
              <span
                className={cn(
                  "rounded-md bg-black/60 px-2 py-0.5 font-bold backdrop-blur-md",
                  fonts.type,
                  "border border-white/20 text-white"
                )}
                style={{
                  textShadow: "0 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.3)",
                }}
              >
                {getCardTypeLabel(card.cardType)}
              </span>
            </div>

            {/* Bottom section - Card info */}
            <div className="space-y-1">
              {/* Card title with embossed effect */}
              <motion.h3
                className={cn("line-clamp-2 font-black tracking-wide text-white", fonts.title)}
                style={{
                  textShadow: getEmbossedTextShadow(
                    card.rarity === "LEGENDARY"
                      ? "gold"
                      : card.rarity === "EPIC"
                        ? "purple"
                        : "silver"
                  ),
                  WebkitTextStroke: "0.5px rgba(0,0,0,0.8)",
                  textRendering: "geometricPrecision",
                }}
                animate={!performanceMode && isHovered ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                {card.title}
              </motion.h3>

              {/* Country name with continent/region */}
              {card.country && (
                <div className="space-y-0.5">
                  <p
                    className={cn("font-semibold text-white/90", fonts.type)}
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                  >
                    {card.country.name}
                  </p>
                  {card.country.continent && (
                    <p className={cn("font-medium text-white/70", fonts.stats)}>
                      {card.country.continent}
                      {card.country.region && ` • ${card.country.region}`}
                    </p>
                  )}
                </div>
              )}

              {/* Government & Economy tier bar */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1",
                  "border border-white/10 bg-black/70 backdrop-blur-md",
                  fonts.stats
                )}
              >
                <span className="font-medium text-white/80">{governmentType}</span>
                <span className="font-bold text-emerald-400">Tier {economyTier}</span>
              </div>

              {/* Season & Market value bar */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1",
                  "border border-white/10 bg-black/70 backdrop-blur-md",
                  fonts.type
                )}
              >
                <span className="font-medium text-white/80">Season {card.season}</span>
                <motion.span
                  className={cn("font-black", rarityConfig.color)}
                  style={{
                    textShadow: `0 0 10px ${rarityConfig.color.includes("yellow") ? "rgba(234, 179, 8, 0.8)" : "rgba(147, 51, 234, 0.8)"}`,
                  }}
                  animate={!performanceMode && isHovered ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {formatMarketValue(card.marketValue)}
                </motion.span>
              </div>

              {/* Nation stats reveal on hover */}
              <AnimatePresence>
                {showStatsOnHover && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "grid grid-cols-2 gap-1 rounded-lg p-2",
                      "border border-white/20 bg-black/80 backdrop-blur-xl",
                      fonts.stats
                    )}
                    style={{
                      boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="flex flex-col px-1">
                      <span className="font-medium text-white/70">Population</span>
                      <span className="font-black text-blue-400">
                        {population >= 1000000
                          ? `${Math.round(population / 1000000)}M`
                          : population >= 1000
                            ? `${Math.round(population / 1000)}K`
                            : population}
                      </span>
                    </div>
                    <div className="flex flex-col px-1">
                      <span className="font-medium text-white/70">GDP</span>
                      <span className="font-black text-emerald-400">
                        {gdp >= 1000000
                          ? `$${(gdp / 1000000).toFixed(1)}T`
                          : gdp >= 1000
                            ? `$${(gdp / 1000).toFixed(1)}B`
                            : `$${gdp}M`}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Level indicator (if enhanced) */}
          {card.level > 1 && (
            <motion.div
              className={cn(
                "absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full",
                "bg-gradient-to-br from-amber-400 to-amber-600",
                "text-sm font-black text-black",
                "border-2 border-amber-300",
                "shadow-lg shadow-amber-500/50"
              )}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: "spring" }}
              whileHover={
                !performanceMode
                  ? {
                      scale: 1.2,
                      rotate: 360,
                      transition: { duration: 0.3 },
                    }
                  : undefined
              }
            >
              {card.level}
            </motion.div>
          )}
        </motion.div>
      </CometCard>
    );
  }
);

NationCardLayout.displayName = "NationCardLayout";
