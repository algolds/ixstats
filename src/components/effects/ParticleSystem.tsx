// src/components/effects/ParticleSystem.tsx
// Reusable particle emitter with multiple particle types

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

/**
 * Particle types
 */
export type ParticleType = "sparkle" | "star" | "confetti" | "circle" | "glow";

/**
 * Particle configuration
 */
export interface ParticleConfig {
  /** Particle type */
  type: ParticleType;
  /** Color(s) for particles */
  colors?: string[];
  /** Number of particles to emit */
  count: number;
  /** Duration in seconds */
  duration?: number;
  /** Size range [min, max] in pixels */
  sizeRange?: [number, number];
  /** Velocity range [min, max] */
  velocityRange?: [number, number];
  /** Spread angle in degrees (0-360) */
  spread?: number;
  /** Origin point { x: %, y: % } */
  origin?: { x: number; y: number };
  /** Enable physics (gravity) */
  physics?: boolean;
}

/**
 * Single particle data
 */
interface Particle {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  type: ParticleType;
}

/**
 * ParticleSystem props
 */
export interface ParticleSystemProps {
  /** Particle configuration */
  config: ParticleConfig;
  /** Trigger to emit particles */
  trigger?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Default colors by particle type
 */
const DEFAULT_COLORS: Record<ParticleType, string[]> = {
  sparkle: ["#fbbf24", "#f59e0b", "#eab308"],
  star: ["#60a5fa", "#3b82f6", "#2563eb"],
  confetti: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"],
  circle: ["#ffffff", "#e5e7eb"],
  glow: ["#a78bfa", "#8b5cf6", "#7c3aed"],
};

/**
 * Generate particles based on configuration
 */
function generateParticles(config: ParticleConfig): Particle[] {
  const particles: Particle[] = [];
  const colors = config.colors || DEFAULT_COLORS[config.type];
  const origin = config.origin || { x: 50, y: 50 };
  const spread = config.spread ?? 360;
  const [minSize, maxSize] = config.sizeRange || [4, 12];
  const [minVelocity, maxVelocity] = config.velocityRange || [2, 6];

  for (let i = 0; i < config.count; i++) {
    // Random angle within spread
    const angleOffset = (Math.random() - 0.5) * spread * (Math.PI / 180);
    const angle = (Math.PI * 2 * i) / config.count + angleOffset;

    // Random velocity
    const velocity =
      minVelocity + Math.random() * (maxVelocity - minVelocity);

    // Random size
    const size = minSize + Math.random() * (maxSize - minSize);

    // Random color
    const color = colors[Math.floor(Math.random() * colors.length)]!;

    particles.push({
      id: `particle-${i}`,
      x: origin.x,
      y: origin.y,
      velocityX: Math.cos(angle) * velocity,
      velocityY: Math.sin(angle) * velocity,
      color,
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      type: config.type,
    });
  }

  return particles;
}

/**
 * Render particle based on type
 */
const ParticleRenderer: React.FC<{
  particle: Particle;
  duration: number;
  physics: boolean;
}> = ({ particle, duration, physics }) => {
  // Calculate final position with physics
  const finalX = particle.x + particle.velocityX * duration * 10;
  const finalY = physics
    ? particle.y + particle.velocityY * duration * 10 + duration * 50 // Gravity
    : particle.y + particle.velocityY * duration * 10;

  const finalRotation = particle.rotation + particle.rotationSpeed * duration * 60;

  // Particle shape based on type
  const renderShape = () => {
    switch (particle.type) {
      case "sparkle":
        return (
          <svg width={particle.size} height={particle.size} viewBox="0 0 20 20">
            <path
              d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z"
              fill={particle.color}
            />
          </svg>
        );

      case "star":
        return (
          <svg width={particle.size} height={particle.size} viewBox="0 0 20 20">
            <polygon
              points="10,1 13,7 19,8 14,13 15,19 10,16 5,19 6,13 1,8 7,7"
              fill={particle.color}
            />
          </svg>
        );

      case "confetti":
        return (
          <div
            style={{
              width: particle.size,
              height: particle.size * 1.5,
              backgroundColor: particle.color,
              borderRadius: "2px",
            }}
          />
        );

      case "circle":
        return (
          <div
            style={{
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: "50%",
            }}
          />
        );

      case "glow":
        return (
          <div
            style={{
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: "50%",
              boxShadow: `0 0 ${particle.size}px ${particle.color}`,
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{
        x: `${particle.x}%`,
        y: `${particle.y}%`,
        opacity: 1,
        rotate: particle.rotation,
      }}
      animate={{
        x: `${finalX}%`,
        y: `${finalY}%`,
        opacity: 0,
        rotate: finalRotation,
      }}
      transition={{
        duration,
        ease: physics ? "easeIn" : "easeOut",
      }}
      style={{
        transformOrigin: "center",
      }}
    >
      {renderShape()}
    </motion.div>
  );
};

/**
 * ParticleSystem - Reusable particle emitter
 *
 * Features:
 * - Multiple particle types (sparkle, star, confetti, circle, glow)
 * - Customizable colors, sizes, velocities
 * - Optional physics (gravity)
 * - Configurable spread and origin
 * - Performance-optimized with React.memo
 * - GPU-accelerated animations
 *
 * @example
 * ```tsx
 * <ParticleSystem
 *   config={{
 *     type: "sparkle",
 *     count: 30,
 *     colors: ["#fbbf24", "#eab308"],
 *     duration: 2,
 *     origin: { x: 50, y: 50 },
 *     physics: true,
 *   }}
 *   trigger={isTriggered}
 *   onComplete={() => console.log("Animation complete")}
 * />
 * ```
 */
export const ParticleSystem = React.memo<ParticleSystemProps>(
  ({ config, trigger = false, onComplete, className }) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [isActive, setIsActive] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const duration = config.duration ?? 2;
    const physics = config.physics ?? false;

    /**
     * Emit particles
     */
    const emit = useCallback(() => {
      const newParticles = generateParticles(config);
      setParticles(newParticles);
      setIsActive(true);

      // Clear after animation
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsActive(false);
        setParticles([]);
        onComplete?.();
      }, duration * 1000);
    }, [config, duration, onComplete]);

    /**
     * Trigger effect
     */
    useEffect(() => {
      if (trigger) {
        emit();
      }
    }, [trigger, emit]);

    /**
     * Cleanup
     */
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <div
        className={cn(
          "absolute inset-0 pointer-events-none overflow-hidden",
          className
        )}
      >
        <AnimatePresence>
          {isActive &&
            particles.map((particle) => (
              <ParticleRenderer
                key={particle.id}
                particle={particle}
                duration={duration}
                physics={physics}
              />
            ))}
        </AnimatePresence>
      </div>
    );
  }
);

ParticleSystem.displayName = "ParticleSystem";
