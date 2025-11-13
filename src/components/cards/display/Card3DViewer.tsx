/**
 * Card3DViewer Component
 * Interactive 3D card rotation viewer with flip animation
 * Shows both CardDisplay (front) and CardBack (back)
 */

"use client";

import React, { useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "~/lib/utils";
import { CardDisplay } from "./CardDisplay";
import { CardBack } from "./CardBack";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

/**
 * Card3DViewer component props
 */
export interface Card3DViewerProps {
  /** Card instance data */
  card: CardInstance;
  /** Display size variant */
  size?: CardDisplaySize;
  /** Initial side to show (default: "front") */
  initialSide?: "front" | "back";
  /** Enable manual flip on click (default: true) */
  enableFlip?: boolean;
  /** Enable drag rotation (default: true) */
  enableDragRotation?: boolean;
  /** Enable mouse/touch tracking (default: true) */
  enableMouseTracking?: boolean;
  /** Rotation sensitivity (default: 1.0) */
  rotationSensitivity?: number;
  /** Additional CSS classes */
  className?: string;
  /** Performance mode - disable heavy effects */
  performanceMode?: boolean;
  /** Callback when card is flipped */
  onFlip?: (side: "front" | "back") => void;
}

/**
 * Card3DViewer - Interactive 3D card viewer with flip animation
 *
 * Features:
 * - 3D card rotation with mouse/touch tracking
 * - Smooth flip animation between front and back
 * - Drag-to-rotate functionality
 * - Perspective controls
 * - Glass physics integration
 * - GPU-accelerated transforms
 * - Mobile-optimized touch controls
 *
 * @example
 * ```tsx
 * <Card3DViewer
 *   card={cardInstance}
 *   size="medium"
 *   enableFlip={true}
 *   enableDragRotation={true}
 * />
 * ```
 */
export const Card3DViewer = React.memo<Card3DViewerProps>(
  ({
    card,
    size = "medium",
    initialSide = "front",
    enableFlip = true,
    enableDragRotation = true,
    enableMouseTracking = true,
    rotationSensitivity = 1.0,
    className,
    performanceMode = false,
    onFlip,
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [currentSide, setCurrentSide] = useState<"front" | "back">(
      initialSide
    );
    const [isDragging, setIsDragging] = useState(false);

    // Motion values for 3D rotation
    const rotateX = useMotionValue(0);
    const rotateY = useMotionValue(0);

    // Spring animations for smooth rotation
    const springConfig = { stiffness: 150, damping: 20 };
    const rotateXSpring = useSpring(rotateX, springConfig);
    const rotateYSpring = useSpring(rotateY, springConfig);

    // Transform for flip animation
    const flipRotation = useTransform(
      rotateYSpring,
      (value) => value + (currentSide === "back" ? 180 : 0)
    );

    /**
     * Handle mouse/touch move for rotation
     */
    const handlePointerMove = (
      e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
      if (!enableMouseTracking && !isDragging) return;
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0]!.clientX;
        clientY = e.touches[0]!.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateYValue =
        ((x - centerX) / centerX) * 25 * rotationSensitivity;
      const rotateXValue =
        -((y - centerY) / centerY) * 25 * rotationSensitivity;

      if (isDragging || enableMouseTracking) {
        rotateX.set(rotateXValue);
        rotateY.set(rotateYValue);
      }
    };

    /**
     * Handle mouse/touch down
     */
    const handlePointerDown = (
      e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
      if (enableDragRotation) {
        setIsDragging(true);
        e.preventDefault();
      }
    };

    /**
     * Handle mouse/touch up
     */
    const handlePointerUp = () => {
      if (enableDragRotation) {
        setIsDragging(false);
        // Reset rotation when drag ends
        if (!enableMouseTracking) {
          rotateX.set(0);
          rotateY.set(0);
        }
      }
    };

    /**
     * Handle mouse leave
     */
    const handleMouseLeave = () => {
      setIsDragging(false);
      if (enableMouseTracking) {
        rotateX.set(0);
        rotateY.set(0);
      }
    };

    /**
     * Handle card flip
     */
    const handleFlip = () => {
      if (!enableFlip) return;

      const newSide = currentSide === "front" ? "back" : "front";
      setCurrentSide(newSide);

      if (onFlip) {
        onFlip(newSide);
      }
    };

    // Size-dependent container dimensions
    const containerSizes = {
      small: "w-32 h-[179px]",
      sm: "w-32 h-[179px]",
      medium: "w-48 h-[269px]",
      md: "w-48 h-[269px]",
      large: "w-64 h-[358px]",
    };

    return (
      <div
        className={cn(
          "relative",
          containerSizes[size],
          enableFlip && "cursor-pointer",
          className
        )}
        style={{
          perspective: "1000px",
        }}
      >
        <motion.div
          ref={containerRef}
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            rotateX: rotateXSpring,
            rotateY: flipRotation,
          }}
          onMouseMove={!performanceMode ? handlePointerMove : undefined}
          onTouchMove={!performanceMode ? handlePointerMove : undefined}
          onMouseDown={!performanceMode ? handlePointerDown : undefined}
          onTouchStart={!performanceMode ? handlePointerDown : undefined}
          onMouseUp={!performanceMode ? handlePointerUp : undefined}
          onTouchEnd={!performanceMode ? handlePointerUp : undefined}
          onMouseLeave={!performanceMode ? handleMouseLeave : undefined}
          onClick={enableFlip ? handleFlip : undefined}
          whileHover={
            !performanceMode && !isDragging
              ? {
                  scale: 1.05,
                  transition: { duration: 0.2 },
                }
              : undefined
          }
        >
          {/* Front of card (CardDisplay) */}
          <motion.div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <CardDisplay
              card={card}
              size={size}
              showStatsOnHover={!isDragging}
              enable3D={false} // Disable internal 3D since viewer handles it
              enableHolographic={true}
              performanceMode={performanceMode}
              className="h-full w-full"
            />
          </motion.div>

          {/* Back of card (CardBack) */}
          <motion.div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              rotateY: "180deg",
            }}
          >
            <CardBack
              rarity={card.rarity}
              size={size}
              performanceMode={performanceMode}
              showRarityVariation={true}
              className="h-full w-full"
            />
          </motion.div>

          {/* Drag indicator overlay */}
          {enableDragRotation && isDragging && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/20 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-md">
                Drag to Rotate
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Flip indicator (subtle) */}
        {enableFlip && !isDragging && (
          <motion.div
            className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/60 p-2 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
          >
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </motion.div>
        )}

        {/* Rotation controls hint (mobile) */}
        {enableDragRotation && !performanceMode && (
          <motion.div
            className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: isDragging ? 0 : 0.5 }}
            transition={{ delay: 0.5 }}
          >
            Drag to rotate
          </motion.div>
        )}

        {/* Glass physics shadow base */}
        {!performanceMode && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 blur-2xl"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${
                currentSide === "front"
                  ? "rgba(147, 51, 234, 0.2)"
                  : "rgba(59, 130, 246, 0.2)"
              }, transparent 70%)`,
            }}
          />
        )}
      </div>
    );
  }
);

Card3DViewer.displayName = "Card3DViewer";
