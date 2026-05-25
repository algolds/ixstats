"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface ScrollIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ScrollIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const mainPathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    translateY: 0,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    translateY: [2, 0],
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

const tailPathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.35,
      ease: "easeOut",
    },
  },
};

const ScrollIcon = forwardRef<ScrollIconHandle, ScrollIconProps>(
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
          <motion.path
            d="M10 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1 2 2h7a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2Z"
            variants={mainPathVariants}
          />
          <motion.path d="M22 17v2a2 2 0 0 1-2 2h-2" variants={tailPathVariants} />
        </motion.svg>
      </div>
    );
  }
);

ScrollIcon.displayName = "ScrollIcon";

export { ScrollIcon };
