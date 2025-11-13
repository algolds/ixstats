// src/components/cards/pack-opening/GlassSplashEffect.tsx
// Premium glass splash effect for card reveals with rarity-specific particles

"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import type { CardRarity } from "@prisma/client";
import { getParticleConfig } from "~/lib/holographic-effects";

interface GlassSplashEffectProps {
  /** Card rarity determines particle count and colors */
  rarity: CardRarity;
  /** Position of the splash effect */
  x: number;
  y: number;
  /** Whether to trigger the effect */
  trigger: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Use mobile-optimized particle count */
  isMobile?: boolean;
}

interface Particle {
  id: string;
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

/**
 * GlassSplashEffect - Premium glass particle burst effect
 *
 * Features:
 * - Rarity-specific particle counts and colors
 * - Radial burst pattern with randomized trajectories
 * - GPU-accelerated transforms (translate3d)
 * - Mobile-optimized particle counts
 * - Glass fragment shimmer effects
 * - Auto-cleanup after animation
 */
export const GlassSplashEffect = React.memo<GlassSplashEffectProps>(
  ({ rarity, x, y, trigger, onComplete, isMobile = false }) => {
    const particleConfig = getParticleConfig(rarity);

    // Generate particles in radial burst pattern
    const particles = useMemo(() => {
      if (!trigger) return [];

      // Reduce particle count on mobile for performance
      const count = isMobile
        ? Math.floor(particleConfig.count * 0.6)
        : particleConfig.count;

      const generated: Particle[] = [];
      const angleStep = (Math.PI * 2) / count;

      for (let i = 0; i < count; i++) {
        // Add randomization to angle for organic feel
        const baseAngle = angleStep * i;
        const angleVariation = (Math.random() - 0.5) * (angleStep * 0.5);
        const angle = baseAngle + angleVariation;

        // Randomize distance for depth perception
        const baseDistance = isMobile ? 80 : 120;
        const distance = baseDistance + Math.random() * (isMobile ? 40 : 80);

        // Particle size from config
        const size =
          particleConfig.size.min +
          Math.random() * (particleConfig.size.max - particleConfig.size.min);

        // Random color from rarity palette
        const color =
          particleConfig.colors[
            Math.floor(Math.random() * particleConfig.colors.length)
          ] || "#ffffff";

        // Stagger delays for wave effect
        const delay = (i / count) * 0.2;

        // Duration with slight randomization
        const duration = 0.8 + Math.random() * 0.4;

        generated.push({
          id: `particle-${i}`,
          angle,
          distance,
          size,
          color,
          delay,
          duration,
        });
      }

      return generated;
    }, [trigger, rarity, isMobile, particleConfig]);

    // Cleanup callback
    const handleAnimationComplete = () => {
      onComplete?.();
    };

    if (!trigger) return null;

    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ willChange: "transform" }}
      >
        {/* Glass shards - main burst particles */}
        {particles.map((particle) => {
          const targetX = Math.cos(particle.angle) * particle.distance;
          const targetY = Math.sin(particle.angle) * particle.distance;

          return (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                backgroundColor: particle.color,
                boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                willChange: "transform, opacity",
              }}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: targetX,
                y: targetY,
                scale: [0, 1.2, 0.5, 0],
                opacity: [1, 0.9, 0.6, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: "easeOut",
              }}
              onAnimationComplete={
                particle.id === particles[particles.length - 1]?.id
                  ? handleAnimationComplete
                  : undefined
              }
            />
          );
        })}

        {/* Central flash burst */}
        <motion.div
          className="absolute rounded-full"
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: "20px",
            height: "20px",
            backgroundColor: particleConfig.colors[0] || "#ffffff",
            boxShadow: `0 0 40px 20px ${particleConfig.colors[0] || "#ffffff"}`,
            willChange: "transform, opacity",
          }}
          initial={{
            scale: 0,
            opacity: 1,
          }}
          animate={{
            scale: [0, 3, 5],
            opacity: [1, 0.6, 0],
          }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
        />

        {/* Glass shimmer ring */}
        <motion.div
          className="absolute rounded-full border-4"
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: "40px",
            height: "40px",
            borderColor: particleConfig.colors[1] || particleConfig.colors[0] || "#ffffff",
            marginLeft: "-20px",
            marginTop: "-20px",
            willChange: "transform, opacity",
          }}
          initial={{
            scale: 0,
            opacity: 1,
          }}
          animate={{
            scale: [0, 2, 4],
            opacity: [1, 0.5, 0],
            rotate: [0, 90, 180],
          }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
        />

        {/* Secondary shimmer ring for legendary+ */}
        {["LEGENDARY", "MYTHIC"].includes(rarity) && (
          <motion.div
            className="absolute rounded-full border-2"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: "60px",
              height: "60px",
              borderColor: particleConfig.colors[2] || particleConfig.colors[0] || "#ffffff",
              marginLeft: "-30px",
              marginTop: "-30px",
              willChange: "transform, opacity",
            }}
            initial={{
              scale: 0,
              opacity: 0.8,
            }}
            animate={{
              scale: [0, 1.5, 3.5],
              opacity: [0.8, 0.4, 0],
              rotate: [0, -90, -180],
            }}
            transition={{
              duration: 1,
              delay: 0.1,
              ease: "easeOut",
            }}
          />
        )}

        {/* Radial light rays for epic+ */}
        {["EPIC", "LEGENDARY", "MYTHIC"].includes(rarity) &&
          Array.from({ length: isMobile ? 6 : 12 }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / (isMobile ? 6 : 12);
            const length = isMobile ? 60 : 100;

            return (
              <motion.div
                key={`ray-${i}`}
                className="absolute h-1 bg-gradient-to-r from-white/80 to-transparent"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${length}px`,
                  transformOrigin: "left center",
                  rotate: `${angle}rad`,
                  willChange: "transform, opacity",
                }}
                initial={{
                  scaleX: 0,
                  opacity: 0,
                }}
                animate={{
                  scaleX: [0, 1, 0],
                  opacity: [0, 0.8, 0],
                }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.02,
                  ease: "easeOut",
                }}
              />
            );
          })}
      </div>
    );
  }
);

GlassSplashEffect.displayName = "GlassSplashEffect";
