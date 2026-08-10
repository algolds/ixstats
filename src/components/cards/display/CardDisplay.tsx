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
import { CometCard } from "~/components/ui/comet-card";
import { RarityBadge } from "./RarityBadge";
import { HolographicOverlay } from "./HolographicOverlay";
import {
  getRarityGlow,
  getRarityConfig,
  getCardWidth,
  getCardAspectRatio,
  formatCardStats,
  getCardTypeLabel,
} from "~/lib/card-display-utils";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import {
  getPremiumBorderConfig,
  getFoilStampConfig,
  getEmbossedTextShadow,
  getMetallicGradient,
} from "~/lib/holographic-effects";
import { proxyNSImage } from "~/lib/ns-image-proxy";
import { CardHolographicCover } from "./CardHolographicCover";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

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
}

/**
 * CardDisplay - Premium trading card component with Yu-Gi-Oh styling
 *
 * Features:
 * - Holographic parallax with multi-layer effects
 * - Rarity-based premium borders with metallic gradients
 * - Embossed text with shadow effects
 * - Foil stamps for high rarities
 * - Animated glow and particle effects
 * - Glass physics depth hierarchy
 * - GPU-accelerated animations
 * - Mobile-optimized performance
 *
 * @example
 * ```tsx
 * <CardDisplay
 *   card={cardInstance}
 *   size="medium"
 *   onClick={(card) => console.log('Clicked:', card.title)}
 *   enableHolographic={true}
 *   hideValue={false}
 * />
 * ```
 */
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
    hideValue = false,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);

    const rarityConfig = getRarityConfig(card.rarity);
    const stats = formatCardStats(card);
    const borderConfig = getPremiumBorderConfig(card.rarity);
    const foilStamp = getFoilStampConfig(card.rarity);

    // Auto-enable holographic for rare+ cards unless explicitly disabled
    const shouldShowHolographic =
      enableHolographic !== false &&
      !performanceMode &&
      ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"].includes(card.rarity);

    // Size-dependent classes
    const widthClass = getCardWidth(size);
    const aspectRatioClass = getCardAspectRatio(size);

    // Font sizes based on card size
    const fontSizes = {
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
    };

    const fonts = fontSizes[size];

    /**
     * Handle card click
     */
    const handleClick = () => {
      if (onClick) {
        onClick(card);
      }
    };

    /**
     * Handle card hover
     */
    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    // Explicit height to ensure proper aspect ratio rendering
    const heightClass =
      size === "small" || size === "sm"
        ? "h-[179px]" // 128px * 3.5/2.5 = 179px
        : size === "medium" || size === "md"
          ? "h-[269px]" // 192px * 3.5/2.5 = 269px
          : "h-[358px]"; // 256px * 3.5/2.5 = 358px

    return (
      <CometCard
        className={cn(
          // Base sizing with explicit height for image fill
          widthClass,
          heightClass,
          // Interactive cursor
          onClick && "cursor-pointer",
          // Smooth transitions
          "transition-all duration-300",
          // Custom classes
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
            // Premium border with gradient
            borderConfig.animated && !performanceMode
              ? `border-${borderConfig.width} ${borderConfig.glow}`
              : `border-${borderConfig.width}`,
            rarityConfig.borderColor
          )}
          style={{
            borderImage: borderConfig.animated
              ? `linear-gradient(135deg, ${borderConfig.gradient
                  .split(" ")
                  .map((c) => `var(--tw-gradient-${c})`)
                  .join(", ")}) 1`
              : undefined,
            borderImageSlice: borderConfig.animated ? 1 : undefined,
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
                unoptimized // NS images may not support Next.js optimization
              />
            ) : (
              <CardHolographicCover
                cardType={card.cardType}
                rarity={card.rarity}
                wikiSource={card.wikiSource}
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

            {/* Rarity glow effect (enhanced) */}
            <motion.div
              className={cn("absolute inset-0 rounded-2xl", getRarityGlow(card.rarity))}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 0.5 : 0.2 }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Card content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-3">
            {/* Top section - Rarity badge & type */}
            <div className="flex items-start justify-between">
              <RarityBadge
                rarity={card.rarity}
                season={card.season}
                size={size === "large" ? "medium" : "small"}
                animated={!performanceMode}
              />
              {card.cardType &&
                (card.cardType === "NS_IMPORT" ? (
                  <span
                    className="inline-flex items-center gap-1 rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400"
                    title="NationStates Import"
                  >
                    NS
                  </span>
                ) : (
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
                ))}
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

              {/* Country name (if available) with premium styling */}
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

              {/* Premium info bar - Season & Market value */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1",
                  "border border-white/10 bg-black/70 backdrop-blur-md",
                  fonts.type
                )}
              >
                <span className="font-medium text-white/80">Est. Value</span>
                {hideValue ? (
                  <span className="text-[10px] text-white/30 italic">Hidden</span>
                ) : (
                  <motion.span
                    className={cn("font-black", rarityConfig.color)}
                    style={{
                      textShadow: `0 0 10px ${rarityConfig.color.includes("yellow") ? "rgba(234, 179, 8, 0.8)" : "rgba(147, 51, 234, 0.8)"}`,
                    }}
                    animate={
                      !performanceMode && isHovered
                        ? {
                            scale: [1, 1.1, 1],
                          }
                        : {}
                    }
                    transition={{ duration: 0.5 }}
                  >
                    <IxCreditsSymbol size="0.8em" variant="ic" className="mr-1" />
                    {card.marketValue.toLocaleString()}
                  </motion.span>
                )}
              </div>

              {/* Stat bars — always visible compact indicator */}
              {Object.keys(stats.base).length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-md">
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

              {/* Premium stats reveal on hover */}
              <AnimatePresence>
                {showStatsOnHover && isHovered && (
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
                          className="font-black"
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

          {/* Level indicator (if enhanced) - floating badge */}
          {card.level > 1 && (
            <motion.div
              className={cn(
                "absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full",
                "bg-gradient-to-br from-amber-400 to-amber-600",
                "text-sm font-black text-black",
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

CardDisplay.displayName = "CardDisplay";
