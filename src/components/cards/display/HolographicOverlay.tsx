/**
 * HolographicOverlay Component
 * Provides premium holographic effects for IxCards
 * Features rainbow shimmer, light rays, foil stamps, and rarity-specific patterns
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { CardRarity } from "@prisma/client";
import { cn } from "~/lib/utils";
import {
  getHolographicPattern,
  getHolographicIntensity,
  getRainbowHolographicGradient,
  getMetallicGradient,
  getHolographicClasses,
  generateLightRays,
  getFoilStampConfig,
  getPremiumBorderConfig,
  getParticleConfig,
  getHolographicAnimation,
  getLightRefractionStyle,
} from "~/lib/themes";

/**
 * HolographicOverlay component props
 */
export interface HolographicOverlayProps {
  /** Card rarity (determines effect intensity) */
  rarity: CardRarity;
  /** Enable mouse tracking for light refraction (default: true) */
  enableMouseTracking?: boolean;
  /** Enable animated light rays (default: true for rare+) */
  enableLightRays?: boolean;
  /** Enable foil stamp (default: true for rare+) */
  enableFoilStamp?: boolean;
  /** Enable particles on hover (default: true for epic+) */
  enableParticles?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Disable all effects (for performance) */
  disabled?: boolean;
}

/**
 * Particle interface for floating particles
 */
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  velocity: {
    x: number;
    y: number;
  };
  lifetime: number;
  opacity: number;
}

/**
 * HolographicOverlay - Premium holographic effects layer
 *
 * Features:
 * - Rarity-based holographic patterns
 * - Mouse-tracked light refraction
 * - Animated light rays
 * - Metallic foil stamps
 * - Floating particles for high rarities
 * - Glass physics integration
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <img src={cardArt} />
 *   <HolographicOverlay rarity="LEGENDARY" />
 * </div>
 * ```
 */
export const HolographicOverlay = React.memo<HolographicOverlayProps>(
  ({
    rarity,
    enableMouseTracking = true,
    enableLightRays = true,
    enableFoilStamp = true,
    enableParticles = true,
    className,
    disabled = false,
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const [particles, setParticles] = useState<Particle[]>([]);
    const particleIdRef = useRef(0);

    const pattern = getHolographicPattern(rarity);
    const _intensity = getHolographicIntensity(rarity);
    const lightRays = generateLightRays(8);
    const foilStamp = getFoilStampConfig(rarity);
    const borderConfig = getPremiumBorderConfig(rarity);
    const particleConfig = getParticleConfig(rarity);
    const _holographicAnimation = getHolographicAnimation(rarity);

    // Show light rays only for rare+ cards
    const showLightRays =
      enableLightRays && ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"].includes(rarity);

    // Show particles only for epic+ cards
    const showParticles = enableParticles && ["EPIC", "LEGENDARY"].includes(rarity);

    // Mouse tracking for light refraction
    useEffect(() => {
      if (!enableMouseTracking || disabled) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setMousePosition({ x, y });
      };

      const container = containerRef.current;
      if (container) {
        container.addEventListener("mousemove", handleMouseMove);
        return () => container.removeEventListener("mousemove", handleMouseMove);
      }
      return;
    }, [enableMouseTracking, disabled]);

    // Particle generation on hover
    useEffect(() => {
      if (!showParticles || !isHovered || disabled) return;

      const interval = setInterval(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const newParticle: Particle = {
          id: particleIdRef.current++,
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          size:
            particleConfig.size.min +
            Math.random() * (particleConfig.size.max - particleConfig.size.min),
          color: particleConfig.colors[Math.floor(Math.random() * particleConfig.colors.length)]!,
          velocity: {
            x: (Math.random() - 0.5) * particleConfig.speed.max,
            y: -Math.random() * particleConfig.speed.max,
          },
          lifetime: particleConfig.lifetime,
          opacity: 1,
        };

        setParticles((prev) => [...prev, newParticle]);
      }, 100); // Create particle every 100ms

      return () => clearInterval(interval);
    }, [showParticles, isHovered, particleConfig, disabled]);

    // Particle cleanup (remove expired particles)
    useEffect(() => {
      if (!showParticles || disabled) return;

      const interval = setInterval(() => {
        setParticles((prev) =>
          prev
            .map((p) => ({
              ...p,
              x: p.x + p.velocity.x,
              y: p.y + p.velocity.y,
              lifetime: p.lifetime - 100,
              opacity: p.lifetime / particleConfig.lifetime,
            }))
            .filter((p) => p.lifetime > 0)
        );
      }, 100);

      return () => clearInterval(interval);
    }, [showParticles, particleConfig.lifetime, disabled]);

    // Return null if disabled
    if (disabled) return null;

    // Calculate light refraction style
    const refractionStyle =
      enableMouseTracking && containerRef.current
        ? getLightRefractionStyle(
            mousePosition.x,
            mousePosition.y,
            containerRef.current.offsetWidth,
            containerRef.current.offsetHeight
          )
        : { transform: "", filter: "" };

    return (
      <div
        ref={containerRef}
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden rounded-2xl",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main holographic layer */}
        <motion.div
          className={cn(getHolographicClasses(rarity))}
          style={{
            backgroundImage:
              pattern === "rainbow-shimmer"
                ? getRainbowHolographicGradient(45, true)
                : pattern === "cosmic"
                  ? "radial-gradient(circle at 50% 50%, rgba(147,51,234,0.4), rgba(236,72,153,0.3), rgba(59,130,246,0.2))"
                  : pattern === "liquid-glass"
                    ? getMetallicGradient("purple")
                    : getMetallicGradient("gold"),
            backgroundSize: "200% 200%",
            backgroundPosition:
              isHovered && containerRef.current
                ? `${(mousePosition.x / (containerRef.current.offsetWidth || 1)) * 100}% ${(mousePosition.y / (containerRef.current.offsetHeight || 1)) * 100}%`
                : "50% 50%",
            opacity: isHovered ? 0.75 : 0,
            transition: "background-position 0.1s ease-out, opacity 0.3s ease-out",
            willChange: "background-position, opacity",
          }}
        />

        {/* Specular Cursor Spotlight — centered directly on mouse cursor */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 140px at ${mousePosition.x}px ${mousePosition.y}px, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.15) 45%, transparent 80%)`,
            }}
          />
        )}

        {/* Light refraction layer */}
        {enableMouseTracking && isHovered && (
          <motion.div
            className="absolute inset-0"
            style={refractionStyle}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        )}

        {/* Animated light rays - originating from mouse cursor */}
        {showLightRays && isHovered && (
          <div className="pointer-events-none absolute inset-0">
            {lightRays.map((ray, index) => (
              <motion.div
                key={index}
                className="pointer-events-none absolute w-1 origin-left bg-gradient-to-r from-white/60 to-transparent"
                style={{
                  left: `${mousePosition.x}px`,
                  top: `${mousePosition.y}px`,
                  height: `${ray.length}%`,
                  transform: `rotate(${ray.angle}deg)`,
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{
                  opacity: [0.2, 0.7, 0.2],
                  scaleX: [0.2, 1, 0.2],
                }}
                transition={{
                  duration: 1.8,
                  delay: ray.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Premium border glow */}
        {borderConfig.animated && (
          <motion.div
            className={cn("absolute inset-0 rounded-2xl border-2", borderConfig.glow)}
            style={{
              borderImageSource: `linear-gradient(135deg, var(--tw-gradient-stops))`,
              borderImageSlice: 1,
            }}
            animate={
              isHovered
                ? {
                    opacity: [0.6, 1, 0.6],
                    scale: [1, 1.02, 1],
                  }
                : {
                    opacity: 0.4,
                  }
            }
            transition={{
              duration: 2,
              repeat: isHovered ? 1 : 0, // Only animate on hover, repeat once
              ease: "easeInOut",
            }}
          />
        )}

        {/* Foil stamp */}
        {enableFoilStamp && foilStamp.enabled && (
          <div
            className={cn(
              "absolute flex items-center justify-center",
              foilStamp.position === "top-right" && "top-2 right-2",
              foilStamp.position === "bottom-right" && "right-2 bottom-2",
              foilStamp.position === "center" &&
                "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
          >
            <motion.div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-2xl",
                "bg-gradient-to-br",
                foilStamp.color,
                "shadow-lg backdrop-blur-sm"
              )}
              style={{
                textShadow: "0 0 10px rgba(255,255,255,0.8)",
              }}
              animate={
                isHovered
                  ? {
                      rotate: [0, 360],
                      scale: [1, 1.1, 1],
                    }
                  : {
                      rotate: 0,
                      scale: 1,
                    }
              }
              transition={{
                rotate: {
                  duration: 20,
                  repeat: 0, // No infinite repeat
                  ease: "linear",
                },
                scale: {
                  duration: 2,
                  repeat: 0, // No infinite repeat
                  ease: "easeInOut",
                },
              }}
            >
              {foilStamp.symbol}
            </motion.div>
          </div>
        )}

        {/* Floating particles */}
        <AnimatePresence>
          {showParticles &&
            particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: particle.x,
                  top: particle.y,
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  opacity: particle.opacity,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            ))}
        </AnimatePresence>

        {/* Shimmer sweep effect on hover */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{
              transform: "skewX(-20deg)",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
    );
  }
);

HolographicOverlay.displayName = "HolographicOverlay";
