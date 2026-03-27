"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface VoteIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface VoteIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const BALLOT_VARIANTS: Variants = {
  normal: {
    opacity: 1,
  },
  animate: {
    opacity: 1,
  },
};

const CHECKMARK_VARIANTS: Variants = {
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

const VoteIcon = forwardRef<VoteIconHandle, VoteIconProps>(
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
          {/* Ballot box */}
          <motion.path
            animate={controls}
            d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"
            initial="normal"
            variants={BALLOT_VARIANTS}
          />
          {/* Checkmark */}
          <motion.path
            animate={controls}
            d="m9 12 2 2 4-4"
            initial="normal"
            variants={CHECKMARK_VARIANTS}
          />
        </svg>
      </div>
    );
  }
);

VoteIcon.displayName = "VoteIcon";

export { VoteIcon };
