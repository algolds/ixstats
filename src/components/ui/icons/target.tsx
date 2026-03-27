"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface TargetIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TargetIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const outerVariants: Variants = {
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

const middleVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.15,
      ease: "easeOut",
    },
  },
};

const innerVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.3,
      ease: "easeOut",
    },
  },
};

const svgVariants: Variants = {
  normal: {
    scale: 1,
  },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.4,
      delay: 0.5,
      ease: "easeInOut",
    },
  },
};

const TargetIcon = forwardRef<TargetIconHandle, TargetIconProps>(
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
          variants={svgVariants}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.circle
            cx="12"
            cy="12"
            r="10"
            variants={outerVariants}
          />
          <motion.circle
            cx="12"
            cy="12"
            r="6"
            variants={middleVariants}
          />
          <motion.circle
            cx="12"
            cy="12"
            r="2"
            variants={innerVariants}
          />
        </motion.svg>
      </div>
    );
  }
);

TargetIcon.displayName = "TargetIcon";

export { TargetIcon };
