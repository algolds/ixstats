"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

interface CardIconProps {
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  holographic?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    width: "w-8",
    height: "h-12",
  },
  md: {
    width: "w-12",
    height: "h-16",
  },
  lg: {
    width: "w-16",
    height: "h-24",
  },
  xl: {
    width: "w-20",
    height: "h-32",
  },
};

export function CardIcon({
  size = "md",
  animated = true,
  holographic = true,
  className,
}: CardIconProps) {
  const config = sizeConfig[size];

  return (
    <motion.div
      className={cn(
        "relative rounded-lg overflow-hidden",
        config.width,
        config.height,
        className
      )}
      initial={{ scale: 1, rotateY: 0 }}
      whileHover={
        animated
          ? {
              scale: 1.05,
              rotateY: [0, 5, -5, 0],
              transition: {
                duration: 0.6,
              },
            }
          : undefined
      }
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Card base with gradient */}
      <div
        className={cn(
          "absolute inset-0 rounded-lg",
          "bg-gradient-to-br from-purple-600 via-blue-500 to-cyan-400",
          "border-2 border-purple-400/50",
          "shadow-lg shadow-purple-500/40"
        )}
      >
        {/* Inner card frame */}
        <div className="absolute inset-2 rounded-md border border-white/20 bg-black/20" />

        {/* Holographic rainbow shimmer */}
        {holographic && (
          <>
            <motion.div
              className="absolute inset-0 rounded-lg"
              style={{
                background:
                  "linear-gradient(135deg, transparent 0%, rgba(255,0,255,0.3) 25%, transparent 50%, rgba(0,255,255,0.3) 75%, transparent 100%)",
              }}
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            {/* Prismatic effect */}
            <div
              className="absolute inset-0 rounded-lg opacity-60"
              style={{
                background:
                  "linear-gradient(45deg, rgba(255,0,0,0.2) 0%, rgba(255,255,0,0.2) 20%, rgba(0,255,0,0.2) 40%, rgba(0,255,255,0.2) 60%, rgba(0,0,255,0.2) 80%, rgba(255,0,255,0.2) 100%)",
                mixBlendMode: "overlay",
              }}
            />
          </>
        )}

        {/* Shine effect */}
        {animated && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{
              x: ["-200%", "200%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 1,
            }}
          />
        )}

        {/* Card sparkle indicator */}
        <motion.div
          className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white shadow-lg shadow-white/50"
          animate={
            animated
              ? {
                  opacity: [0.5, 1, 0.5],
                  scale: [0.8, 1.2, 0.8],
                }
              : undefined
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </motion.div>
  );
}

// Utility component for card stacks
export function CardStack({
  count = 3,
  size = "md",
  className,
}: {
  count?: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  return (
    <div className={cn("relative", className)} style={{ perspective: "1000px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-0 left-0"
          style={{
            zIndex: count - i,
            transform: `translateY(${i * 4}px) translateX(${i * 2}px) rotateZ(${i * -2}deg)`,
          }}
          animate={{
            y: [0, -2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        >
          <CardIcon size={size} animated={false} holographic={i === 0} />
        </motion.div>
      ))}
    </div>
  );
}
