// src/components/cards/pack-opening/Stage3_CardReveal.tsx
// Stage 3: Sequential card flip reveals with rarity effects

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardInstance } from "~/types/pack-opening";
import { getPackOpeningService } from "~/lib/pack-opening-service";
import { GlassSplashEffect } from "./GlassSplashEffect";
import { getParticleConfig } from "~/lib/holographic-effects";

interface Stage3_CardRevealProps {
  cards: CardInstance[];
  onRevealComplete: () => void;
}

/**
 * Stage3_CardReveal - Sequential card flip animation with premium glass effects
 *
 * Features:
 * - Sequential reveals with 800ms stagger
 * - Dramatic 3D flip animation (full 180° with enhanced perspective)
 * - Rarity-based sound effects
 * - GlassSplashEffect on each card reveal
 * - Holographic shimmer burst
 * - Rarity-specific particle effects (10-30+ particles)
 * - Glass refraction during flip
 * - Final "all revealed" celebration effect
 * - Automatic progression when complete
 */
export const Stage3_CardReveal = React.memo<Stage3_CardRevealProps>(
  ({ cards, onRevealComplete }) => {
    const [revealedIndex, setRevealedIndex] = useState(-1);
    const [allRevealed, setAllRevealed] = useState(false);
    const service = getPackOpeningService();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    // Sequential reveal logic
    useEffect(() => {
      if (revealedIndex >= cards.length - 1) {
        // All cards revealed, trigger celebration then complete
        setAllRevealed(true);
        const timer = setTimeout(() => {
          onRevealComplete();
        }, 1500); // Extended to show celebration effect
        return () => clearTimeout(timer);
      }

      // Reveal next card after stagger delay
      const timer = setTimeout(
        () => {
          setRevealedIndex((prev) => prev + 1);
        },
        revealedIndex === -1 ? 500 : 800 // First card starts after 500ms
      );

      return () => clearTimeout(timer);
    }, [revealedIndex, cards.length, onRevealComplete]);

    // Play sound when card is revealed
    useEffect(() => {
      if (revealedIndex >= 0 && revealedIndex < cards.length) {
        const card = cards[revealedIndex];
        if (card) {
          service.playRaritySound(card.rarity);

          // Haptic feedback based on rarity
          if (["LEGENDARY", "EPIC"].includes(card.rarity)) {
            service.triggerHaptic("heavy");
          } else if (["ULTRA_RARE", "RARE"].includes(card.rarity)) {
            service.triggerHaptic("medium");
          } else {
            service.triggerHaptic("light");
          }
        }
      }
    }, [revealedIndex, cards, service]);

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-4">
        {/* Card grid layout */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <AnimatePresence mode="sync">
            {cards.map((card, index) => (
              <CardRevealItem
                key={card.id}
                card={card}
                index={index}
                isRevealed={index <= revealedIndex}
                service={service}
                isMobile={isMobile}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Progress indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2">
            {cards.map((_, index) => (
              <motion.div
                key={index}
                className="h-2 w-2 rounded-full"
                initial={{ backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                animate={{
                  backgroundColor:
                    index <= revealedIndex
                      ? "rgba(255, 255, 255, 1)"
                      : "rgba(255, 255, 255, 0.3)",
                  scale: index === revealedIndex ? 1.5 : 1,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>

        {/* Final celebration effect when all cards revealed */}
        {allRevealed && (
          <>
            {/* Radial burst */}
            <motion.div
              className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-yellow-400/30 via-orange-400/30 to-red-400/30"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: [0, 2, 3], opacity: [1, 0.5, 0] }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            {/* Celebration particles */}
            {Array.from({ length: isMobile ? 15 : 30 }).map((_, i) => {
              const angle = (Math.PI * 2 * i) / (isMobile ? 15 : 30);
              const distance = isMobile ? 150 : 250;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              const size = 4 + Math.random() * 8;
              const colors = ["#fbbf24", "#f97316", "#ef4444", "#ec4899", "#a855f7"];
              const color = colors[Math.floor(Math.random() * colors.length)];

              return (
                <motion.div
                  key={`celebration-${i}`}
                  className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: color,
                    boxShadow: `0 0 ${size * 2}px ${color}`,
                  }}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x,
                    y,
                    scale: [0, 1.5, 0],
                    opacity: [1, 0.8, 0],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 1 + Math.random() * 0.5,
                    delay: i * 0.02,
                    ease: "easeOut",
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    );
  }
);

Stage3_CardReveal.displayName = "Stage3_CardReveal";

/**
 * Individual card reveal item with enhanced 3D flip animation and glass effects
 */
interface CardRevealItemProps {
  card: CardInstance;
  index: number;
  isRevealed: boolean;
  service: ReturnType<typeof getPackOpeningService>;
  isMobile: boolean;
}

const CardRevealItem = React.memo<CardRevealItemProps>(
  ({ card, index, isRevealed, service, isMobile }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [showSplash, setShowSplash] = useState(false);
    const [cardCenterX, setCardCenterX] = useState(0);
    const [cardCenterY, setCardCenterY] = useState(0);
    const cardRef = React.useRef<HTMLDivElement>(null);

    // Calculate card center position for splash effect
    useEffect(() => {
      if (isRevealed && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setCardCenterX(rect.width / 2);
        setCardCenterY(rect.height / 2);
      }
    }, [isRevealed]);

    useEffect(() => {
      if (isRevealed && !isFlipped) {
        // Small delay before flip starts
        const timer = setTimeout(() => {
          setIsFlipped(true);
          // Trigger glass splash effect slightly after flip starts
          setTimeout(() => setShowSplash(true), 300);
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [isRevealed, isFlipped]);

    const rarityColor = service.getRarityColor(card.rarity);
    const particleConfig = getParticleConfig(card.rarity);

    return (
      <motion.div
        ref={cardRef}
        initial={{ scale: 0, opacity: 0, y: 50 }}
        animate={{
          scale: isRevealed ? 1 : 0,
          opacity: isRevealed ? 1 : 0,
          y: isRevealed ? 0 : 50,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
        style={{
          perspective: "1500px", // Enhanced perspective for more dramatic 3D effect
        }}
      >
        {/* 3D flip container with enhanced animation */}
        <motion.div
          className="relative h-96 w-72"
          animate={{
            rotateY: isFlipped ? 180 : 0,
            scale: isFlipped ? [1, 1.05, 1] : 1, // Slight scale pulse on flip
          }}
          transition={{
            duration: 0.8, // Slightly longer for more dramatic reveal
            ease: [0.43, 0.13, 0.23, 0.96], // Custom cubic-bezier for smooth animation
          }}
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {/* Glass splash effect on reveal */}
          {showSplash && (
            <GlassSplashEffect
              rarity={card.rarity}
              x={cardCenterX}
              y={cardCenterY}
              trigger={showSplash}
              isMobile={isMobile}
            />
          )}
          {/* Card back */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 backdrop-blur-sm"
            style={{
              backfaceVisibility: "hidden",
            }}
          >
            {/* Glass refraction shimmer effect during flip */}
            {isFlipped && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-white/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 0.4 }}
                style={{
                  backdropFilter: "blur(8px)",
                }}
              />
            )}
            <div className="flex h-full items-center justify-center">
              <div className="text-6xl font-bold text-white/40">?</div>
            </div>
          </div>

          {/* Card front */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* Enhanced rarity glow with pulsing effect */}
            <motion.div
              className="absolute -inset-2 rounded-2xl blur-xl"
              style={{
                backgroundColor: rarityColor,
              }}
              animate={{
                opacity: isFlipped ? [0, 0.9, 0.6, 0.8] : 0,
                scale: isFlipped ? [1, 1.1, 1.05, 1.08] : 1,
              }}
              transition={{
                duration: 1.5,
                times: [0, 0.2, 0.6, 1],
                repeat: Infinity,
                repeatDelay: 2,
              }}
            />

            {/* Holographic shimmer burst for rare+ cards */}
            {isFlipped && ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY", "MYTHIC"].includes(card.rarity) && (
              <>
                {/* Primary shimmer burst */}
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background: `radial-gradient(circle at center, ${rarityColor}40 0%, transparent 70%)`,
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: [0, 0.8, 0.4, 0.6],
                    scale: [0.8, 1.2, 1, 1.1],
                    rotate: [0, 45, 90],
                  }}
                  transition={{
                    duration: 2,
                    times: [0, 0.3, 0.6, 1],
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                />

                {/* Particle shimmer ring for legendary+ */}
                {["LEGENDARY", "MYTHIC"].includes(card.rarity) && (
                  <motion.div
                    className="pointer-events-none absolute -inset-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {Array.from({ length: isMobile ? 8 : 12 }).map((_, i) => {
                      const angle = (Math.PI * 2 * i) / (isMobile ? 8 : 12);
                      const radius = 140;
                      const x = Math.cos(angle) * radius;
                      const y = Math.sin(angle) * radius;

                      return (
                        <motion.div
                          key={`shimmer-${i}`}
                          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: particleConfig.colors[i % particleConfig.colors.length],
                            boxShadow: `0 0 10px ${particleConfig.colors[i % particleConfig.colors.length]}`,
                          }}
                          animate={{
                            x: [0, x, x * 1.2, x],
                            y: [0, y, y * 1.2, y],
                            scale: [0, 1, 1.5, 1],
                            opacity: [0, 1, 0.5, 0.8],
                          }}
                          transition={{
                            duration: 2,
                            delay: i * 0.05,
                            repeat: Infinity,
                            repeatDelay: 1,
                          }}
                        />
                      );
                    })}
                  </motion.div>
                )}
              </>
            )}

            {/* Card content */}
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-1">
              {/* Card image */}
              <div
                className="h-full w-full rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: `url(${card.artwork})`,
                }}
              >
                {/* Gradient overlay */}
                <div className="h-full w-full bg-gradient-to-t from-black/80 via-transparent to-transparent p-4">
                  {/* Card info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="text-sm font-medium uppercase tracking-wide text-white/60">
                      {card.rarity.replace("_", " ")}
                    </div>
                    <div className="mt-1 text-xl font-bold text-white">
                      {card.name || card.title || "Unknown Card"}
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      Season {card.season}
                    </div>
                  </div>

                  {/* Rarity badge */}
                  <div
                    className="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${rarityColor}80`,
                      color: "white",
                      boxShadow: `0 0 20px ${rarityColor}`,
                    }}
                  >
                    {card.rarity.replace("_", " ")}
                  </div>
                </div>
              </div>
            </div>

            {/* Shine effect on reveal */}
            {isFlipped && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 1,
                  delay: 0.3,
                  ease: "linear",
                }}
                style={{
                  transform: "skewX(-20deg)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

CardRevealItem.displayName = "CardRevealItem";
