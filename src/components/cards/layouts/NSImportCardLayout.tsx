/**
 * NSImportCardLayout Component
 * Specialized layout for NS-imported trading cards
 *
 * Features:
 * - NationStates badge display
 * - NS-specific metadata (region, card category, trophies)
 * - NS card ID and season display
 * - NS-themed styling
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
 * NSImportCardLayout component props
 */
export interface NSImportCardLayoutProps {
  /** Card instance data */
  card: CardInstance;
  /** Display size variant */
  size?: CardDisplaySize;
  /** Click handler */
  onClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show NS metadata on hover (default: true) */
  showNSMetadataOnHover?: boolean;
  /** Enable 3D tilt effect (default: true) */
  enable3D?: boolean;
  /** Enable holographic effects (default: true for rare+) */
  enableHolographic?: boolean;
  /** Performance mode - disable heavy effects */
  performanceMode?: boolean;
}

/**
 * NSImportCardLayout - Specialized layout for NationStates imported cards
 *
 * Features NS badge, NS-specific metadata, and NS-themed styling
 *
 * @example
 * ```tsx
 * <NSImportCardLayout
 *   card={nsCard}
 *   size="medium"
 *   onClick={(card) => console.log('Clicked:', card.title)}
 * />
 * ```
 */
export const NSImportCardLayout = React.memo<NSImportCardLayoutProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    showNSMetadataOnHover = true,
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

    // Extract NS-specific metadata
    const nsData = card.nsData as Record<string, any> || {};
    const nsCardId = card.nsCardId || null;
    const nsSeason = card.nsSeason || null;
    const nsRegion = nsData.region || "Unknown Region";
    const nsCategory = nsData.category || "Unknown";
    const nsTrophies = nsData.trophies || 0;
    const nsMarketValue = nsData.marketValue || card.marketValue;

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
          whileHover={
            !performanceMode
              ? { scale: 1.02, transition: { duration: 0.2 } }
              : undefined
          }
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
                className="absolute inset-0 mix-blend-overlay opacity-10"
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
              className={cn(
                "absolute inset-0 rounded-2xl",
                getRarityGlow(card.rarity)
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 0.5 : 0.2 }}
              transition={{ duration: 0.3 }}
            />

            {/* NATIONSTATES BADGE - Top-left corner */}
            <motion.div
              className="absolute top-3 left-3 z-10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-md font-bold backdrop-blur-md border",
                  fonts.type,
                  "bg-green-600/80 text-white border-green-400/50"
                )}
                style={{
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                <span className="text-base">🌍</span>
                <span>NS</span>
              </div>
            </motion.div>

            {/* NS Card ID & Season badge - Top-right corner */}
            {nsCardId && nsSeason && (
              <motion.div
                className="absolute top-3 right-3 z-10"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className={cn(
                    "px-2 py-1 rounded-md font-bold backdrop-blur-md border text-right",
                    fonts.stats,
                    "bg-blue-600/80 text-white border-blue-400/50"
                  )}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  <div>#{nsCardId}</div>
                  <div className="text-[8px] text-blue-200">S{nsSeason}</div>
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
                  "text-white border border-white/20"
                )}
                style={{
                  textShadow:
                    "0 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.3)",
                }}
              >
                {getCardTypeLabel(card.cardType)}
              </span>
            </div>

            {/* Bottom section - Card info */}
            <div className="space-y-1">
              {/* Card title with embossed effect */}
              <motion.h3
                className={cn(
                  "font-black text-white line-clamp-2 tracking-wide",
                  fonts.title
                )}
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
                animate={
                  !performanceMode && isHovered
                    ? { scale: [1, 1.02, 1] }
                    : {}
                }
                transition={{ duration: 0.4 }}
              >
                {card.title}
              </motion.h3>

              {/* NS Region & Category */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1",
                  "bg-black/70 backdrop-blur-md border border-white/10",
                  fonts.stats
                )}
              >
                <span className="text-white/80 font-medium truncate">
                  {nsRegion}
                </span>
                <span className="text-green-400 font-bold">{nsCategory}</span>
              </div>

              {/* Season & Market value bar */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1",
                  "bg-black/70 backdrop-blur-md border border-white/10",
                  fonts.type
                )}
              >
                <span className="text-white/80 font-medium">
                  Season {card.season}
                </span>
                <motion.span
                  className={cn("font-black", rarityConfig.color)}
                  style={{
                    textShadow: `0 0 10px ${rarityConfig.color.includes("yellow") ? "rgba(234, 179, 8, 0.8)" : "rgba(147, 51, 234, 0.8)"}`,
                  }}
                  animate={
                    !performanceMode && isHovered
                      ? { scale: [1, 1.1, 1] }
                      : {}
                  }
                  transition={{ duration: 0.5 }}
                >
                  {formatMarketValue(card.marketValue)}
                </motion.span>
              </div>

              {/* NS metadata reveal on hover */}
              <AnimatePresence>
                {showNSMetadataOnHover && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "rounded-lg p-2",
                      "bg-black/80 backdrop-blur-xl border border-green-400/30",
                      fonts.stats
                    )}
                    style={{
                      boxShadow:
                        "0 4px 20px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-white/70 font-medium text-[9px]">
                          NS Card ID
                        </span>
                        <span className="font-black text-blue-400">
                          #{nsCardId || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/70 font-medium text-[9px]">
                          NS Season
                        </span>
                        <span className="font-black text-cyan-400">
                          S{nsSeason || "N/A"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/70 font-medium text-[9px]">
                          Trophies
                        </span>
                        <span className="font-black text-yellow-400">
                          🏆 {nsTrophies}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/70 font-medium text-[9px]">
                          NS Value
                        </span>
                        <span className="font-black text-emerald-400">
                          {formatMarketValue(nsMarketValue)}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`https://www.nationstates.net/page=deck/card=${nsCardId}/season=${nsSeason}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-2 text-green-400 hover:text-green-300 underline text-[9px] text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on NationStates →
                    </a>
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
                "bg-gradient-to-br from-green-400 to-green-600",
                "text-sm font-black text-white",
                "border-2 border-green-300",
                "shadow-lg shadow-green-500/50"
              )}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
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

NSImportCardLayout.displayName = "NSImportCardLayout";
