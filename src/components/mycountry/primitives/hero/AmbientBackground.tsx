"use client";

import React from "react";
import Image from "next/image";
import { motion } from "motion/react";

interface AmbientBackgroundProps {
  imageUrl: string | null;
  gradient: string;
  isLoading?: boolean;
  className?: string;
  overlayOpacity?: number;
  blur?: string;
  parallaxAmount?: number;
}

export function AmbientBackground({
  imageUrl,
  gradient,
  isLoading = false,
  className = "",
  overlayOpacity = 0.6,
  blur = "0px",
  parallaxAmount = 1.1,
}: AmbientBackgroundProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Loading state */}
      {isLoading && (
        <motion.div
          className="absolute inset-0"
          style={{ background: gradient }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Image background */}
      {imageUrl ? (
        <motion.div
          className="absolute inset-0"
          initial={{ scale: parallaxAmount, opacity: 0 }}
          animate={{ scale: parallaxAmount, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ filter: blur !== "0px" ? `blur(${blur})` : undefined }}
        >
          <Image src={imageUrl} alt="" fill className="object-cover" priority sizes="100vw" />
        </motion.div>
      ) : (
        /* Fallback gradient */
        <motion.div
          className="absolute inset-0"
          style={{ background: gradient }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Overlay gradient for text readability */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(to bottom,
            rgba(0, 0, 0, ${overlayOpacity}) 0%,
            rgba(0, 0, 0, ${overlayOpacity * 0.5}) 50%,
            rgba(0, 0, 0, ${overlayOpacity * 0.8}) 100%
          )`,
        }}
      />

      {/* Bottom fade to background */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{
          background: "linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
