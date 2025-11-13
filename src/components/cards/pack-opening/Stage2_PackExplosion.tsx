// src/components/cards/pack-opening/Stage2_PackExplosion.tsx
// Stage 2: Enhanced explosion effect with premium glass physics and rarity-aware particles

"use client";

import React, { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardInstance } from "~/types/pack-opening";
import type { CardRarity } from "@prisma/client";
import { getPackOpeningService, getOptimalParticleCount } from "~/lib/pack-opening-service";
import { getParticleConfig } from "~/lib/holographic-effects";

interface Stage2_PackExplosionProps {
  cards: CardInstance[];
  onComplete: () => void;
}

/**
 * Stage2_PackExplosion - Enhanced explosive pack opening animation
 *
 * Features:
 * - Premium particle burst system (50 particles desktop, 30 mobile)
 * - Rarity-aware particle colors (detects highest rarity in pack)
 * - Glass shards and fragments
 * - Enhanced flash effect with color tinting
 * - Camera shake effect (subtle)
 * - Radial burst lines (extended)
 * - Cards fly out in arc pattern
 * - 800ms duration
 * - GPU-accelerated transforms
 * - Sound sync points
 */
export const Stage2_PackExplosion = React.memo<Stage2_PackExplosionProps>(
  ({ cards, onComplete }) => {
    const service = getPackOpeningService();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    // Enhanced particle count: 50 desktop, 30 mobile
    const particleCount = isMobile ? 30 : 50;

    // Detect highest rarity in pack for color theming
    const highestRarity = useMemo(() => {
      const rarityOrder: Record<CardRarity, number> = {
        COMMON: 0,
        UNCOMMON: 1,
        RARE: 2,
        ULTRA_RARE: 3,
        EPIC: 4,
        LEGENDARY: 5,
      };

      let highest: CardRarity = "COMMON";
      let highestValue = 0;

      cards.forEach((card) => {
        const value = rarityOrder[card.rarity] || 0;
        if (value > highestValue) {
          highestValue = value;
          highest = card.rarity;
        }
      });

      return highest;
    }, [cards]);

    const rarityParticleConfig = getParticleConfig(highestRarity);

    // Generate particles with rarity-specific colors
    const particles = useMemo(
      () => {
        const generated = [];
        for (let i = 0; i < particleCount; i++) {
          const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
          const speed = 1 + Math.random() * 2;
          const size = 3 + Math.random() * 8;
          const color = rarityParticleConfig.colors[
            Math.floor(Math.random() * rarityParticleConfig.colors.length)
          ] || "#ffffff";

          generated.push({
            id: `particle-${i}`,
            x: 50,
            y: 50,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            size,
            color,
          });
        }
        return generated;
      },
      [particleCount, rarityParticleConfig]
    );

    // Auto-complete after animation
    useEffect(() => {
      const timer = setTimeout(() => {
        onComplete();
      }, 800);

      return () => clearTimeout(timer);
    }, [onComplete]);

    // Play explosion sound on mount
    useEffect(() => {
      service.playPackOpenSound();
      service.triggerHaptic("heavy");
    }, [service]);

    const primaryColor = rarityParticleConfig.colors[0] || "#ffffff";

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        {/* Camera shake container */}
        <motion.div
          className="absolute inset-0"
          animate={{
            x: [0, -2, 2, -2, 2, 0],
            y: [0, 2, -2, 2, -2, 0],
          }}
          transition={{
            duration: 0.4,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            ease: "easeOut",
          }}
        >
          {/* Enhanced flash effect with rarity color tint */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle, ${primaryColor}40 0%, white 50%, transparent 100%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.3, 0] }}
            transition={{ duration: 0.4, times: [0, 0.3, 0.7, 1] }}
          />

          {/* Secondary white flash */}
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.25, times: [0, 0.4, 1] }}
          />

          {/* Enhanced particle system with glass shards */}
          <AnimatePresence>
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  willChange: "transform, opacity",
                }}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  opacity: 1,
                }}
                animate={{
                  x: `${particle.velocityX * 120}px`,
                  y: `${particle.velocityY * 120}px`,
                  scale: [0, 1.3, 0.7, 0],
                  opacity: [1, 0.9, 0.5, 0],
                  rotate: [0, 180 * Math.sign(particle.velocityX), 360 * Math.sign(particle.velocityX)],
                }}
                transition={{
                  duration: 0.9,
                  ease: "easeOut",
                }}
              >
                {/* Glass shard particle */}
                <div
                  className="rounded-full"
                  style={{
                    backgroundColor: particle.color,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    boxShadow: `0 0 ${particle.size * 3}px ${particle.color}, inset 0 0 ${particle.size}px rgba(255,255,255,0.5)`,
                  }}
                />
                {/* Glass shimmer trail */}
                <motion.div
                  className="absolute -inset-1 rounded-full"
                  style={{
                    backgroundColor: particle.color,
                    filter: "blur(4px)",
                  }}
                  animate={{
                    opacity: [0.6, 0.3, 0],
                    scale: [1, 1.5, 2],
                  }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

        {/* Cards flying out in arc pattern */}
        <div className="relative h-full w-full">
          {cards.map((card, index) => {
            // Calculate arc positions (spread in semicircle)
            const totalCards = cards.length;
            const angle = (Math.PI * (index - (totalCards - 1) / 2)) / totalCards;
            const distance = 150; // pixels
            const targetX = Math.sin(angle) * distance;
            const targetY = -Math.abs(Math.cos(angle)) * distance - 100;

            // Rotation for flying effect
            const rotation = angle * (180 / Math.PI) * 2;

            return (
              <motion.div
                key={card.id}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  rotate: 0,
                  opacity: 0,
                }}
                animate={{
                  x: targetX,
                  y: targetY,
                  scale: [0, 1.2, 0.8],
                  rotate: rotation,
                  opacity: [0, 1, 0.8],
                }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.05,
                  ease: "easeOut",
                }}
                style={{
                  willChange: "transform, opacity",
                }}
              >
                {/* Mini card representation */}
                <div className="h-32 w-24 rounded-lg bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm">
                  <div
                    className="h-full w-full rounded-lg bg-cover bg-center opacity-60"
                    style={{
                      backgroundImage: `url(${card.artwork})`,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

          {/* Enhanced radial burst lines with rarity colors */}
          {Array.from({ length: isMobile ? 12 : 18 }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / (isMobile ? 12 : 18);
            const length = isMobile ? 100 : 150;
            const burstColor = rarityParticleConfig.colors[i % rarityParticleConfig.colors.length] || "#ffffff";

            return (
              <motion.div
                key={`burst-${i}`}
                className="absolute left-1/2 top-1/2"
                style={{
                  transformOrigin: "left center",
                  rotate: `${angle}rad`,
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{
                  scaleX: [0, 1.2, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.02,
                  ease: "easeOut",
                }}
              >
                {/* Main burst line */}
                <div
                  className="h-1.5 bg-gradient-to-r"
                  style={{
                    width: `${length}px`,
                    background: `linear-gradient(to right, ${burstColor}CC 0%, ${burstColor}66 50%, transparent 100%)`,
                    boxShadow: `0 0 8px ${burstColor}`,
                  }}
                />
                {/* Glow trail */}
                <div
                  className="absolute inset-0 h-3 -translate-y-1/4 bg-gradient-to-r blur-sm"
                  style={{
                    width: `${length}px`,
                    background: `linear-gradient(to right, ${burstColor}40 0%, transparent 100%)`,
                  }}
                />
              </motion.div>
            );
          })}

          {/* Enhanced center explosion rings with rarity colors */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
            style={{
              width: "40px",
              height: "40px",
              borderColor: primaryColor,
              boxShadow: `0 0 30px ${primaryColor}, inset 0 0 20px ${primaryColor}40`,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{
              scale: [0, 4, 6],
              opacity: [1, 0.6, 0],
            }}
            transition={{
              duration: 0.9,
              ease: "easeOut",
            }}
          />

          {/* Secondary explosion ring */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80"
            style={{
              width: "60px",
              height: "60px",
              boxShadow: "0 0 40px rgba(255,255,255,0.8)",
            }}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{
              scale: [0, 3, 5],
              opacity: [0.8, 0.4, 0],
            }}
            transition={{
              duration: 1,
              delay: 0.1,
              ease: "easeOut",
            }}
          />

          {/* Glass fragment effects for epic+ */}
          {["EPIC", "LEGENDARY", "MYTHIC"].includes(highestRarity) &&
            Array.from({ length: isMobile ? 8 : 16 }).map((_, i) => {
              const angle = (Math.PI * 2 * i) / (isMobile ? 8 : 16);
              const distance = isMobile ? 60 : 100;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              const fragmentColor = rarityParticleConfig.colors[i % rarityParticleConfig.colors.length];

              return (
                <motion.div
                  key={`fragment-${i}`}
                  className="absolute left-1/2 top-1/2 h-4 w-1 rounded-full"
                  style={{
                    backgroundColor: fragmentColor,
                    boxShadow: `0 0 10px ${fragmentColor}`,
                  }}
                  initial={{
                    x: 0,
                    y: 0,
                    scale: 0,
                    opacity: 1,
                    rotate: angle * (180 / Math.PI),
                  }}
                  animate={{
                    x,
                    y,
                    scale: [0, 1.5, 0],
                    opacity: [1, 0.8, 0],
                    rotate: angle * (180 / Math.PI) + 360,
                  }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.03,
                    ease: "easeOut",
                  }}
                />
              );
            })}
        </motion.div>
      </div>
    );
  }
);

Stage2_PackExplosion.displayName = "Stage2_PackExplosion";
