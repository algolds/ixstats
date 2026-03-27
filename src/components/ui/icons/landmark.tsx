"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface LandmarkIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LandmarkIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const baseVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

const columnVariants = (index: number): Variants => ({
  normal: {
    scaleY: 1,
    opacity: 1,
  },
  animate: {
    scaleY: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.25,
      delay: 0.05 * index,
      ease: "easeOut",
    },
  },
});

const beamVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.2,
      delay: 0.2,
      ease: "easeOut",
    },
  },
};

const roofVariants: Variants = {
  normal: {
    translateY: 0,
    opacity: 1,
  },
  animate: {
    translateY: [-5, 0],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.2,
      ease: "easeOut",
    },
  },
};

const LandmarkIcon = forwardRef<LandmarkIconHandle, LandmarkIconProps>(
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
          {/* Base line */}
          <motion.line
            x1="3"
            y1="22"
            x2="21"
            y2="22"
            variants={baseVariants}
          />
          {/* Columns - rise from bottom */}
          <motion.line
            x1="6"
            y1="18"
            x2="6"
            y2="11"
            variants={columnVariants(0)}
            style={{ transformOrigin: "center bottom" }}
          />
          <motion.line
            x1="10"
            y1="18"
            x2="10"
            y2="11"
            variants={columnVariants(1)}
            style={{ transformOrigin: "center bottom" }}
          />
          <motion.line
            x1="14"
            y1="18"
            x2="14"
            y2="11"
            variants={columnVariants(2)}
            style={{ transformOrigin: "center bottom" }}
          />
          <motion.line
            x1="18"
            y1="18"
            x2="18"
            y2="11"
            variants={columnVariants(3)}
            style={{ transformOrigin: "center bottom" }}
          />
          {/* Beam */}
          <motion.line
            x1="2"
            y1="11"
            x2="22"
            y2="11"
            variants={beamVariants}
          />
          {/* Roof */}
          <motion.polygon
            points="12 2 20 10 4 10"
            variants={roofVariants}
          />
        </motion.svg>
      </div>
    );
  }
);

LandmarkIcon.displayName = "LandmarkIcon";

export { LandmarkIcon };
