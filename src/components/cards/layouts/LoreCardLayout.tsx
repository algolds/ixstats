/**
 * LoreCardLayout Component
 * Specialized layout for Lore-type trading cards
 *
 * Features:
 * - Rich text area with wiki content
 * - Historical stats display
 * - Wiki source badge (IxWiki/IIWiki)
 * - Lore-specific styling with story focus
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
import { WikiLinkPreview } from "~/components/wiki/WikiLinkPreview";

/**
 * LoreCardLayout component props
 */
export interface LoreCardLayoutProps {
  /** Card instance data */
  card: CardInstance;
  /** Display size variant */
  size?: CardDisplaySize;
  /** Click handler */
  onClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show lore text on hover (default: true) */
  showLoreOnHover?: boolean;
  /** Enable 3D tilt effect (default: true) */
  enable3D?: boolean;
  /** Enable holographic effects (default: true for rare+) */
  enableHolographic?: boolean;
  /** Performance mode - disable heavy effects */
  performanceMode?: boolean;
}

/**
 * LoreCardLayout - Specialized layout for Lore cards
 *
 * Features wiki source badge, rich text display, and lore-specific styling
 *
 * @example
 * ```tsx
 * <LoreCardLayout
 *   card={loreCard}
 *   size="medium"
 *   onClick={(card) => console.log('Clicked:', card.title)}
 * />
 * ```
 */
export const LoreCardLayout = React.memo<LoreCardLayoutProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    showLoreOnHover = true,
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
      small: { title: "text-xs", type: "text-[10px]", stats: "text-[10px]", lore: "text-[9px]" },
      sm: { title: "text-xs", type: "text-[10px]", stats: "text-[10px]", lore: "text-[9px]" },
      medium: { title: "text-sm", type: "text-xs", stats: "text-xs", lore: "text-[10px]" },
      md: { title: "text-sm", type: "text-xs", stats: "text-xs", lore: "text-[10px]" },
      large: { title: "text-base", type: "text-sm", stats: "text-sm", lore: "text-xs" },
    };

    const fonts = fontSizes[size];

    // Extract lore-specific metadata
    const loreDescription = card.description || "No lore text available.";
    const wikiSource = card.wikiSource || "Unknown";
    const wikiArticleTitle = card.wikiArticleTitle || card.title;
    const wikiUrl = card.wikiUrl || null;

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
                wikiSource={card.wikiSource}
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

            {/* WIKI SOURCE BADGE - Top-left corner */}
            <motion.div
              className="absolute top-3 left-3 z-10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className={cn(
                  "px-3 py-1 rounded-md font-bold backdrop-blur-md border",
                  fonts.type,
                  wikiSource === "ixwiki"
                    ? "bg-blue-600/80 text-white border-blue-400/50"
                    : wikiSource === "iiwiki"
                    ? "bg-green-600/80 text-white border-green-400/50"
                    : "bg-gray-600/80 text-white border-gray-400/50"
                )}
                style={{
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {wikiSource === "ixwiki"
                  ? "IxWiki"
                  : wikiSource === "iiwiki"
                  ? "IIWiki"
                  : "Wiki"}
              </div>
            </motion.div>
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

              {/* Wiki article title (if different from card title) */}
              {wikiArticleTitle && wikiArticleTitle !== card.title && (
                <p
                  className={cn("text-white/90 font-semibold italic", fonts.type)}
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                >
                  "{wikiArticleTitle}"
                </p>
              )}

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

              {/* Lore text reveal on hover - LARGER AREA */}
              <AnimatePresence>
                {showLoreOnHover && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "rounded-lg p-3",
                      "bg-black/85 backdrop-blur-xl border border-purple-400/30",
                      fonts.lore,
                      "max-h-32 overflow-y-auto"
                    )}
                    style={{
                      boxShadow:
                        "0 4px 20px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                    }}
                  >
                    <div className="text-white/90 leading-relaxed line-clamp-6">
                      {loreDescription}
                    </div>
                    {wikiUrl && (
                      <WikiLinkPreview
                        title={wikiArticleTitle || wikiUrl.split("/wiki/").pop()?.replace(/_/g, " ") || ""}
                        wiki={card.wikiSource as "ixwiki" | "iiwiki" | undefined}
                      >
                        <a
                          href={wikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2 text-purple-400 hover:text-purple-300 underline text-[9px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on Wiki →
                        </a>
                      </WikiLinkPreview>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Historical stats badge (if available) */}
              {!isHovered && card.stats && (
                <div
                  className={cn(
                    "flex items-center justify-center rounded-lg px-2 py-1",
                    "bg-purple-900/40 backdrop-blur-md border border-purple-400/20",
                    fonts.stats
                  )}
                >
                  <span className="text-purple-300 font-medium">
                    📚 Historical Record
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Level indicator (if enhanced) */}
          {card.level > 1 && (
            <motion.div
              className={cn(
                "absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full",
                "bg-gradient-to-br from-purple-400 to-purple-600",
                "text-sm font-black text-white",
                "border-2 border-purple-300",
                "shadow-lg shadow-purple-500/50"
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

LoreCardLayout.displayName = "LoreCardLayout";
