// src/components/cards/pack-opening/Stage2_PackExplosion.tsx
// Stage 2: Explosion effect with particle system and cards flying out

"use client";

import React, { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardInstance } from "~/types/pack-opening";
import { getPackOpeningService, getOptimalParticleCount } from "~/lib/pack-opening-service";

interface Stage2_PackExplosionProps {
  cards: CardInstance[];
  onComplete: () => void;
}

/**
 * Stage2_PackExplosion - Explosive pack opening animation
 *
 * Features:
 * - Particle burst system (50 particles desktop, 25 mobile)
 * - Cards fly out in arc pattern
 * - 800ms duration
 * - GPU-accelerated transforms
 * - Automatic progression to next stage
 */
export const Stage2_PackExplosion = React.memo<Stage2_PackExplosionProps>(
  ({ cards, onComplete }) => {
    const service = getPackOpeningService();
    const particleCount = getOptimalParticleCount();
    const particles = useMemo(
      () => service.generateParticles(particleCount),
      [service, particleCount]
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

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        {/* Flash effect */}
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: 0.3, times: [0, 0.5, 1] }}
        />

        {/* Particle system */}
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                backgroundColor: particle.color,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
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
                x: `${particle.velocityX * 100}px`,
                y: `${particle.velocityY * 100}px`,
                scale: [0, 1, 0.5],
                opacity: [1, 0.8, 0],
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
              }}
            />
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

        {/* Radial burst lines */}
        {[...Array(12)].map((_, i) => {
          const angle = (Math.PI * 2 * i) / 12;
          const length = 200;
          const x = Math.cos(angle) * length;
          const y = Math.sin(angle) * length;

          return (
            <motion.div
              key={`burst-${i}`}
              className="absolute left-1/2 top-1/2 h-1 w-24 bg-gradient-to-r from-white/80 to-transparent"
              style={{
                transformOrigin: "left center",
                rotate: `${angle * (180 / Math.PI)}rad`,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{
                scaleX: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.6,
                delay: i * 0.03,
                ease: "easeOut",
              }}
            />
          );
        })}

        {/* Center explosion ring */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/60"
          initial={{ scale: 0, opacity: 1 }}
          animate={{
            scale: [0, 3, 4],
            opacity: [1, 0.5, 0],
          }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
        />
      </div>
    );
  }
);

Stage2_PackExplosion.displayName = "Stage2_PackExplosion";
