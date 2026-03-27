"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface BrainIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BrainIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const LEFT_HEMISPHERE_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      opacity: { duration: 0.1 },
    },
  },
};

const RIGHT_HEMISPHERE_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.2,
      opacity: { duration: 0.1, delay: 0.2 },
    },
  },
};

const SYNAPSE_VARIANTS: Variants = {
  normal: {
    opacity: 1,
  },
  animate: {
    opacity: [0.3, 1, 0.5, 1],
    transition: {
      duration: 0.5,
      delay: 0.4,
      ease: "easeInOut",
    },
  },
};

const LEFT_DETAIL_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.2,
      delay: 0.1,
      opacity: { duration: 0.1, delay: 0.1 },
    },
  },
};

const RIGHT_DETAIL_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.2,
      delay: 0.3,
      opacity: { duration: 0.1, delay: 0.3 },
    },
  },
};

const BrainIcon = forwardRef<BrainIconHandle, BrainIconProps>(
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
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left hemisphere */}
          <motion.path
            animate={controls}
            d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
            initial="normal"
            variants={LEFT_HEMISPHERE_VARIANTS}
          />
          {/* Right hemisphere */}
          <motion.path
            animate={controls}
            d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
            initial="normal"
            variants={RIGHT_HEMISPHERE_VARIANTS}
          />
          {/* Center synapse */}
          <motion.path
            animate={controls}
            d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"
            initial="normal"
            variants={SYNAPSE_VARIANTS}
          />
          {/* Left detail paths */}
          <motion.path
            animate={controls}
            d="M6.003 5.125A3 3 0 0 0 6.401 6.5"
            initial="normal"
            variants={LEFT_DETAIL_VARIANTS}
          />
          <motion.path
            animate={controls}
            d="M3.477 10.896a4 4 0 0 1 .585-.396"
            initial="normal"
            variants={LEFT_DETAIL_VARIANTS}
          />
          <motion.path
            animate={controls}
            d="M6 18a4 4 0 0 1-1.967-.516"
            initial="normal"
            variants={LEFT_DETAIL_VARIANTS}
          />
          {/* Right detail paths */}
          <motion.path
            animate={controls}
            d="M17.599 6.5a3 3 0 0 0 .399-1.375"
            initial="normal"
            variants={RIGHT_DETAIL_VARIANTS}
          />
          <motion.path
            animate={controls}
            d="M19.938 10.5a4 4 0 0 1 .585.396"
            initial="normal"
            variants={RIGHT_DETAIL_VARIANTS}
          />
          <motion.path
            animate={controls}
            d="M19.967 17.484A4 4 0 0 1 18 18"
            initial="normal"
            variants={RIGHT_DETAIL_VARIANTS}
          />
        </svg>
      </div>
    );
  }
);

BrainIcon.displayName = "BrainIcon";

export { BrainIcon };
