/**
 * GlassSplashEffect Component
 * Liquid glass "splash" effect for card reveals
 * Features particle burst system with glass refraction animation
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardRarity } from "@prisma/client";
import { cn } from "~/lib/utils";
import { getParticleConfig } from "~/lib/holographic-effects";

/**
 * GlassSplashEffect component props
 */
export interface GlassSplashEffectProps {
  /** Trigger effect (set to true to start animation) */
  trigger: boolean;
  /** Card rarity (determines particle colors and intensity) */
  rarity: CardRarity;
  /** Callback when effect completes */
  onComplete?: () => void;
  /** Effect origin position (default: center) */
  origin?: { x: number; y: number };
  /** Container dimensions (default: 100% parent) */
  dimensions?: { width: number; height: number };
  /** Additional CSS classes */
  className?: string;
  /** Particle count multiplier (default: 1.0) */
  intensity?: number;
}

/**
 * Particle interface for glass splash particles
 */
interface SplashParticle {
  id: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  lifetime: number;
  blur: number;
}

/**
 * GlassSplashEffect - Premium liquid glass splash animation
 *
 * Features:
 * - Particle burst system with physics
 * - Glass refraction animation
 * - Rarity-specific colors
 * - GPU-accelerated transforms
 * - Radial shockwave effect
 * - Liquid glass trail effects
 *
 * @example
 * ```tsx
 * <GlassSplashEffect
 *   trigger={showEffect}
 *   rarity="LEGENDARY"
 *   onComplete={() => setShowEffect(false)}
 * />
 * ```
 */
export const GlassSplashEffect = React.memo<GlassSplashEffectProps>(
  ({
    trigger,
    rarity,
    onComplete,
    origin = { x: 50, y: 50 },
    dimensions,
    className,
    intensity = 1.0,
  }) => {
    const [particles, setParticles] = useState<SplashParticle[]>([]);
    const [isActive, setIsActive] = useState(false);
    const particleConfig = getParticleConfig(rarity);

    /**
     * Generate splash particles
     */
    const generateSplashParticles = useCallback((): SplashParticle[] => {
      const particleCount = Math.floor(
        particleConfig.count * 2 * intensity
      );
      const newParticles: SplashParticle[] = [];

      for (let i = 0; i < particleCount; i++) {
        // Random angle and speed for radial burst
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
        const speed =
          particleConfig.speed.min +
          Math.random() *
            (particleConfig.speed.max - particleConfig.speed.min);

        newParticles.push({
          id: i,
          x: origin.x,
          y: origin.y,
          velocityX: Math.cos(angle) * speed * 10,
          velocityY: Math.sin(angle) * speed * 10,
          size:
            particleConfig.size.min +
            Math.random() *
              (particleConfig.size.max - particleConfig.size.min),
          color:
            particleConfig.colors[
              Math.floor(Math.random() * particleConfig.colors.length)
            ]!,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          opacity: 1,
          lifetime: particleConfig.lifetime,
          blur: Math.random() * 4,
        });
      }

      return newParticles;
    }, [origin, particleConfig, intensity]);

    /**
     * Start splash effect
     */
    useEffect(() => {
      if (trigger && !isActive) {
        setIsActive(true);
        setParticles(generateSplashParticles());

        // Complete effect after duration
        const timeout = setTimeout(() => {
          setIsActive(false);
          setParticles([]);
          if (onComplete) {
            onComplete();
          }
        }, particleConfig.lifetime);

        return () => clearTimeout(timeout);
      }
    }, [
      trigger,
      isActive,
      generateSplashParticles,
      particleConfig.lifetime,
      onComplete,
    ]);

    /**
     * Animate particles
     */
    useEffect(() => {
      if (!isActive || particles.length === 0) return;

      const animationFrame = setInterval(() => {
        setParticles((prevParticles) =>
          prevParticles
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.velocityX,
              y: particle.y + particle.velocityY,
              velocityY: particle.velocityY + 0.5, // Gravity effect
              rotation: particle.rotation + particle.rotationSpeed,
              opacity:
                (particle.lifetime - 100) /
                particleConfig.lifetime,
              lifetime: particle.lifetime - 100,
            }))
            .filter((particle) => particle.lifetime > 0)
        );
      }, 100);

      return () => clearInterval(animationFrame);
    }, [isActive, particles.length, particleConfig.lifetime]);

    if (!isActive) return null;

    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-50 overflow-hidden",
          className
        )}
        style={
          dimensions
            ? { width: dimensions.width, height: dimensions.height }
            : undefined
        }
      >
        {/* Radial shockwave */}
        <AnimatePresence>
          <motion.div
            className="absolute rounded-full border-4"
            style={{
              left: `${origin.x}%`,
              top: `${origin.y}%`,
              borderColor:
                particleConfig.colors[0] || "rgba(147, 51, 234, 0.6)",
            }}
            initial={{
              width: 0,
              height: 0,
              opacity: 1,
              x: "-50%",
              y: "-50%",
            }}
            animate={{
              width: 400,
              height: 400,
              opacity: 0,
            }}
            transition={{
              duration: 0.8,
              ease: "easeOut",
            }}
          />
        </AnimatePresence>

        {/* Secondary shockwave */}
        <AnimatePresence>
          <motion.div
            className="absolute rounded-full border-2"
            style={{
              left: `${origin.x}%`,
              top: `${origin.y}%`,
              borderColor:
                particleConfig.colors[1] || "rgba(236, 72, 153, 0.4)",
            }}
            initial={{
              width: 0,
              height: 0,
              opacity: 0.8,
              x: "-50%",
              y: "-50%",
            }}
            animate={{
              width: 600,
              height: 600,
              opacity: 0,
            }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              delay: 0.1,
            }}
          />
        </AnimatePresence>

        {/* Glass refraction burst */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${origin.x}% ${origin.y}%, rgba(255,255,255,0.6) 0%, transparent 40%)`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 2, 3] }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
        />

        {/* Particle system */}
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                opacity: particle.opacity,
                rotate: particle.rotation,
                filter: `blur(${particle.blur}px)`,
                boxShadow: `0 0 ${particle.size * 2}px ${particle.color}, 0 0 ${particle.size * 4}px ${particle.color}`,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </AnimatePresence>

        {/* Liquid glass trail effect */}
        {particles.slice(0, 5).map((particle) => (
          <motion.div
            key={`trail-${particle.id}`}
            className="absolute"
            style={{
              left: `${origin.x}%`,
              top: `${origin.y}%`,
              width: 2,
              height: Math.sqrt(
                Math.pow(particle.x - origin.x, 2) +
                  Math.pow(particle.y - origin.y, 2)
              ),
              background: `linear-gradient(to bottom, ${particle.color} 0%, transparent 100%)`,
              transformOrigin: "top",
              rotate: Math.atan2(
                particle.y - origin.y,
                particle.x - origin.x
              ) * (180 / Math.PI) + 90,
              opacity: particle.opacity * 0.3,
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3 }}
          />
        ))}

        {/* Central glass burst core */}
        <motion.div
          className="absolute rounded-full"
          style={{
            left: `${origin.x}%`,
            top: `${origin.y}%`,
            background: `radial-gradient(circle, ${particleConfig.colors[0]} 0%, transparent 70%)`,
          }}
          initial={{
            width: 10,
            height: 10,
            opacity: 1,
            x: "-50%",
            y: "-50%",
          }}
          animate={{
            width: 100,
            height: 100,
            opacity: 0,
          }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
          }}
        />

        {/* Rarity-specific accent effects */}
        {rarity === "LEGENDARY" && (
          <>
            {/* Extra intense burst for legendary/mythic */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at ${origin.x}% ${origin.y}%, rgba(255,215,0,0.4) 0%, transparent 50%)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{
                duration: 0.8,
                ease: "easeInOut",
                repeat: 2,
              }}
            />
            {/* Star burst pattern */}
            {[0, 45, 90, 135].map((angle) => (
              <motion.div
                key={angle}
                className="absolute left-1/2 top-1/2 h-1 w-full origin-left bg-gradient-to-r from-yellow-400 to-transparent"
                style={{
                  rotate: angle,
                  x: "-50%",
                  y: "-50%",
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                  delay: 0.1,
                }}
              />
            ))}
          </>
        )}
      </div>
    );
  }
);

GlassSplashEffect.displayName = "GlassSplashEffect";
