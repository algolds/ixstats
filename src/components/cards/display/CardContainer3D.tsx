/**
 * CardContainer3D Component
 * 3D perspective wrapper for card display with mouse tracking
 * Phase 1: Card Display Components
 */

"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

/**
 * CardContainer3D component props
 */
export interface CardContainer3DProps {
  /** Card content to display */
  children: React.ReactNode;
  /** Tilt intensity (0-1, default: 0.5) */
  intensity?: number;
  /** Enable 3D tilt effect (default: true) */
  enabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CardContainer3D - 3D perspective wrapper with mouse tracking
 *
 * Features:
 * - Mouse-tracked tilt effect
 * - Configurable tilt intensity
 * - GPU-accelerated transforms
 * - Smooth spring animations
 * - Depth perception with shadows
 *
 * @example
 * ```tsx
 * <CardContainer3D intensity={0.7}>
 *   <CardDisplay card={card} />
 * </CardContainer3D>
 * ```
 */
export const CardContainer3D = React.memo<CardContainer3DProps>(
  ({ children, intensity = 0.5, enabled = true, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });

    /**
     * Handle mouse move for tilt effect
     */
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate rotation based on mouse position
      // Normalize to -1 to 1 range
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 15 * intensity;
      const rotateX = ((centerY - e.clientY) / (rect.height / 2)) * 15 * intensity;

      setRotation({ x: rotateX, y: rotateY });
    };

    /**
     * Reset rotation on mouse leave
     */
    const handleMouseLeave = () => {
      setIsHovered(false);
      setRotation({ x: 0, y: 0 });
    };

    /**
     * Set hover state
     */
    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    return (
      <div
        ref={containerRef}
        className={cn("perspective-distant", className)}
        style={{
          perspective: "1000px",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className="transform-3d relative"
          style={{
            transformStyle: "preserve-3d",
          }}
          animate={{
            rotateX: enabled ? rotation.x : 0,
            rotateY: enabled ? rotation.y : 0,
            scale: isHovered && enabled ? 1.02 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.5,
          }}
        >
          {/* Shadow layer for depth */}
          {enabled && isHovered && (
            <motion.div
              className="absolute inset-0 -z-10 rounded-2xl blur-xl"
              style={{
                background: "radial-gradient(circle, rgba(0,0,0,0.3) 0%, transparent 70%)",
                transform: "translateZ(-50px) scale(1.1)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}

          {/* Card content */}
          <div
            className="relative"
            style={{
              transformStyle: "preserve-3d",
            }}
          >
            {children}
          </div>
        </motion.div>
      </div>
    );
  }
);

CardContainer3D.displayName = "CardContainer3D";
