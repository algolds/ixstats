"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface LayersIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LayersIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const bottomLayerVariants: Variants = {
  normal: {
    opacity: 1,
    translateY: 0,
  },
  animate: {
    opacity: [0, 1],
    translateY: [3, 0],
    transition: {
      duration: 0.3,
      delay: 0,
      ease: "easeOut",
    },
  },
};

const middleLayerVariants: Variants = {
  normal: {
    opacity: 1,
    translateY: 0,
  },
  animate: {
    opacity: [0, 1],
    translateY: [3, 0],
    transition: {
      duration: 0.3,
      delay: 0.15,
      ease: "easeOut",
    },
  },
};

const topLayerVariants: Variants = {
  normal: {
    opacity: 1,
    translateY: 0,
  },
  animate: {
    opacity: [0, 1],
    translateY: [3, 0],
    transition: {
      duration: 0.3,
      delay: 0.3,
      ease: "easeOut",
    },
  },
};

const LayersIcon = forwardRef<LayersIconHandle, LayersIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <motion.svg
          animate={controls}
          fill="none"
          height={size}
          initial="normal"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Bottom layer (main shape) - appears first */}
          <motion.path
            d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"
            variants={bottomLayerVariants}
          />
          {/* Middle layer - appears second */}
          <motion.path
            d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
            variants={middleLayerVariants}
          />
          {/* Top layer - appears last */}
          <motion.path
            d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"
            variants={topLayerVariants}
          />
        </motion.svg>
      </div>
    );
  }
);

LayersIcon.displayName = "LayersIcon";

export { LayersIcon };
