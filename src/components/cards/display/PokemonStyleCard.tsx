/**
 * PokemonStyleCard Component - Pokemon TCG-Inspired 3D Card
 * Enhanced 3D tilt with multi-layer holographic composition
 * Implements Pokemon-style holographic patterns and effects
 */

"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, useMotionValue } from "motion/react";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { RarityBadge } from "./RarityBadge";
import {
  getRarityGlow,
  getRarityConfig,
  getCardWidth,
  formatCardStats,
  formatMarketValue,
  getCardTypeLabel,
} from "~/lib/card-display-utils";
import {
  getPokemon3DTiltStyle,
  getSparkleGridGradient,
  getPrismaticWaveGradient,
  getHolofoilTextureGradient,
  getPremiumBorderConfig,
  getEmbossedTextShadow,
} from "~/lib/holographic-effects";
import { proxyNSImage } from "~/lib/ns-image-proxy";
import { useSoundService } from "~/lib/sound-service";
import { CardHolographicCover } from "./CardHolographicCover";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

/**
 * PokemonStyleCard component props
 */
export interface PokemonStyleCardProps {
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
  /** Tilt intensity multiplier (default: 1) */
  tiltIntensity?: number;
  /** Performance mode - disable heavy effects */
  performanceMode?: boolean;
  /** Enable holographic layers (default: true for rare+) */
  enableHolographic?: boolean;
}

/**
 * Mouse position interface for 3D tilt
 */
interface MousePosition {
  x: number;
  y: number;
}

/**
 * PokemonStyleCard - Pokemon TCG-inspired card with enhanced 3D effects
 *
 * Features:
 * - Pokemon-style 3D tilt with mouse tracking (15deg max rotation)
 * - Multi-layer composition: base → holographic → shine → glare
 * - Blend modes: overlay, screen, color-dodge for authentic holo effect
 * - Enhanced perspective transforms (1200px perspective)
 * - Rarity-specific holographic patterns (sparkle-grid, prismatic-wave, holofoil)
 * - Dynamic glare positioning (opposite to mouse for realistic reflection)
 * - Performance mode toggle
 * - GPU-accelerated with will-change and transform3d
 *
 * Layer Stack (bottom to top):
 * 1. Base layer (artwork)
 * 2. Holographic pattern layer (sparkle/wave/foil based on rarity)
 * 3. Shine layer (radial gradient following mouse)
 * 4. Glare layer (diagonal highlight opposite to mouse)
 * 5. UI overlay (rarity badge, text, stats)
 *
 * @example
 * ```tsx
 * <PokemonStyleCard
 *   card={cardInstance}
 *   size="medium"
 *   enable3D={true}
 *   tiltIntensity={1.2}
 *   performanceMode={false}
 * />
 * ```
 */
export const PokemonStyleCard = React.memo<PokemonStyleCardProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    showStatsOnHover = true,
    enable3D = true,
    tiltIntensity = 1,
    performanceMode = false,
    enableHolographic,
  }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState<MousePosition>({
      x: 0,
      y: 0,
    });
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);
    const soundService = useSoundService();

    // Motion values for smooth animations
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rarityConfig = getRarityConfig(card.rarity);
    const stats = formatCardStats(card);
    const borderConfig = getPremiumBorderConfig(card.rarity);

    // Auto-enable holographic for rare+ cards unless explicitly disabled
    const shouldShowHolographic =
      enableHolographic !== false &&
      !performanceMode &&
      ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"].includes(card.rarity);

    // Size-dependent classes
    const widthClass = getCardWidth(size);

    // Explicit dimensions (maintaining 2.5:3.5 aspect ratio)
    const dimensions = {
      small: { width: "w-32", height: "h-[179px]" },
      sm: { width: "w-32", height: "h-[179px]" },
      medium: { width: "w-48", height: "h-[269px]" },
      md: { width: "w-48", height: "h-[269px]" },
      large: { width: "w-64", height: "h-[358px]" },
    };

    const { width: sizeWidth, height: sizeHeight } = dimensions[size];

    // Font sizes based on card size
    const fontSizes = {
      small: { title: "text-xs", type: "text-[10px]", stats: "text-[10px]" },
      sm: { title: "text-xs", type: "text-[10px]", stats: "text-[10px]" },
      medium: { title: "text-sm", type: "text-xs", stats: "text-xs" },
      md: { title: "text-sm", type: "text-xs", stats: "text-xs" },
      large: { title: "text-base", type: "text-sm", stats: "text-sm" },
    };

    const fonts = fontSizes[size];

    /**
     * Get holographic pattern based on rarity
     */
    const getHolographicPattern = useCallback(() => {
      switch (card.rarity) {
        case "ULTRA_RARE":
          return getPrismaticWaveGradient();
        case "EPIC":
          return getSparkleGridGradient();
        case "LEGENDARY":
          // Combine sparkle grid with prismatic wave for legendary
          return `${getSparkleGridGradient()}, ${getPrismaticWaveGradient()}`;
        case "RARE":
        default:
          return getHolofoilTextureGradient();
      }
    }, [card.rarity]);

    /**
     * Handle mouse move for 3D tilt tracking
     */
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !enable3D || performanceMode) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setMousePosition({ x, y });
        mouseX.set(x);
        mouseY.set(y);
      },
      [enable3D, performanceMode, mouseX, mouseY]
    );

    /**
     * Handle mouse enter
     */
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      soundService?.play("card-hover", 0.3);
    }, [soundService]);

    /**
     * Handle mouse leave
     */
    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      setMousePosition({ x: 0, y: 0 });
      mouseX.set(0);
      mouseY.set(0);
    }, [mouseX, mouseY]);

    /**
     * Handle card click
     */
    const handleClick = useCallback(() => {
      soundService?.play("card-select");
      onClick?.(card);
    }, [soundService, onClick, card]);

    // Calculate 3D tilt styles
    const tiltStyle =
      enable3D && !performanceMode && isHovered && cardRef.current
        ? getPokemon3DTiltStyle(
            mousePosition.x,
            mousePosition.y,
            cardRef.current.offsetWidth,
            cardRef.current.offsetHeight,
            tiltIntensity
          )
        : {
            cardTransform: "perspective(1200px) rotateX(0deg) rotateY(0deg)",
            glareTransform: "translate(50%, 50%)",
            glareOpacity: 0,
            backgroundPosition: "50% 50%",
          };

    return (
      <div
        className={cn(
          sizeWidth,
          sizeHeight,
          "relative transition-all duration-300",
          className
        )}
        style={{
          perspective: "1200px",
          transformStyle: "preserve-3d",
        }}
      >
        <motion.div
          ref={cardRef}
          className={cn(
            "relative h-full w-full overflow-hidden rounded-2xl",
            onClick && "cursor-pointer",
            `border-${borderConfig.width}`,
            rarityConfig.borderColor
          )}
          style={{
            transform: tiltStyle.cardTransform,
            transformStyle: "preserve-3d",
            willChange: "transform",
            transition: "transform 0.1s ease-out",
            borderImage: borderConfig.animated
              ? `${borderConfig.gradient} 1`
              : undefined,
            borderImageSlice: borderConfig.animated ? 1 : undefined,
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
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
          {/* Layer 1: Base artwork */}
          <div
            className="absolute inset-0"
            style={{
              transform: "translateZ(0px)",
              willChange: "transform",
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

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          </div>

          {/* Layer 2: Holographic pattern layer (rare+ only) */}
          {shouldShowHolographic && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: getHolographicPattern(),
                backgroundSize: "400% 400%",
                backgroundPosition: tiltStyle.backgroundPosition,
                mixBlendMode: "overlay",
                opacity: 0.4,
                transform: "translateZ(5px)",
                willChange: "background-position, opacity",
              }}
              animate={
                isHovered
                  ? {
                      backgroundPosition: [
                        tiltStyle.backgroundPosition,
                        tiltStyle.backgroundPosition,
                      ],
                      opacity: [0.4, 0.6, 0.4],
                    }
                  : {
                      backgroundPosition: "50% 50%", // Static position when not hovered
                      opacity: 0.4,
                    }
              }
              transition={{
                backgroundPosition: {
                  duration: 0.3,
                  ease: "easeOut",
                  repeat: 0, // No infinite repeat
                },
                opacity: {
                  duration: 2,
                  repeat: isHovered ? 1 : 0, // Only repeat once on hover
                  ease: "easeInOut",
                },
              }}
            />
          )}

          {/* Layer 3: Shine layer (radial gradient following mouse) */}
          {shouldShowHolographic && isHovered && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at ${(mousePosition.x / (cardRef.current?.offsetWidth || 1)) * 100}% ${(mousePosition.y / (cardRef.current?.offsetHeight || 1)) * 100}%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.2) 20%, transparent 60%)`,
                mixBlendMode: "screen",
                transform: "translateZ(10px)",
                willChange: "opacity",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Layer 4: Glare layer (diagonal highlight opposite to mouse) */}
          {shouldShowHolographic && isHovered && (
            <motion.div
              className="absolute pointer-events-none"
              style={{
                width: "150%",
                height: "150%",
                left: "-25%",
                top: "-25%",
                background:
                  "linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.8) 45%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.8) 55%, transparent 100%)",
                mixBlendMode: "color-dodge",
                transform: `${tiltStyle.glareTransform} rotate(45deg) translateZ(15px)`,
                opacity: tiltStyle.glareOpacity * 0.7,
                willChange: "transform, opacity",
                transition: "transform 0.1s ease-out, opacity 0.1s ease-out",
              }}
            />
          )}

          {/* Layer 5: UI Overlay */}
          <div
            className="absolute inset-0 flex flex-col justify-between p-3"
            style={{
              transform: "translateZ(20px)",
              willChange: "transform",
            }}
          >
            {/* Top section - Rarity badge & type */}
            <div className="flex items-start justify-between">
              <RarityBadge
                rarity={card.rarity}
                size={size === "large" ? "medium" : "small"}
                animated={!performanceMode}
              />
              {card.cardType && (
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
              )}
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
                    ? {
                        scale: [1, 1.02, 1],
                      }
                    : {}
                }
                transition={{ duration: 0.4 }}
              >
                {card.title}
              </motion.h3>

              {/* Country name (if available) */}
              {card.country && (
                <p
                  className={cn("text-white/90 font-semibold", fonts.type)}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  {card.country.name}
                </p>
              )}

              {/* Info bar - Season & Market value */}
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
                      ? {
                          scale: [1, 1.1, 1],
                        }
                      : {}
                  }
                  transition={{ duration: 0.5 }}
                >
                  {formatMarketValue(card.marketValue)}
                </motion.span>
              </div>

              {/* Stats reveal on hover */}
              {showStatsOnHover && isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "grid grid-cols-1 xs:grid-cols-2 gap-1 rounded-lg p-2",
                    "bg-black/80 backdrop-blur-xl border border-white/20",
                    fonts.stats
                  )}
                  style={{
                    boxShadow:
                      "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                  }}
                >
                  {Object.entries(stats).map(([key, stat]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-1"
                    >
                      <span className="text-white/70 font-medium">
                        {stat.label}
                      </span>
                      <span
                        className={cn("font-black", stat.color)}
                        style={{
                          textShadow: `0 0 8px currentColor`,
                        }}
                      >
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
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
              style={{
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                transform: "translateZ(25px)",
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

          {/* Premium rarity glow (outer) */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-2xl pointer-events-none",
              getRarityGlow(card.rarity)
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 0.4 : 0.2 }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      </div>
    );
  }
);

PokemonStyleCard.displayName = "PokemonStyleCard";
