"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface LayoutDashboardIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LayoutDashboardIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const RECT1_VARIANTS: Variants = {
  normal: {
    scaleX: 1,
    scaleY: 1,
  },
  animate: {
    scaleX: [0, 1],
    scaleY: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0,
      ease: "easeOut",
    },
  },
};

const RECT2_VARIANTS: Variants = {
  normal: {
    scaleX: 1,
    scaleY: 1,
  },
  animate: {
    scaleX: [0, 1],
    scaleY: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.08,
      ease: "easeOut",
    },
  },
};

const RECT3_VARIANTS: Variants = {
  normal: {
    scaleX: 1,
    scaleY: 1,
  },
  animate: {
    scaleX: [0, 1],
    scaleY: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.16,
      ease: "easeOut",
    },
  },
};

const RECT4_VARIANTS: Variants = {
  normal: {
    scaleX: 1,
    scaleY: 1,
  },
  animate: {
    scaleX: [0, 1],
    scaleY: [0, 1],
    transition: {
      duration: 0.3,
      delay: 0.24,
      ease: "easeOut",
    },
  },
};

const LayoutDashboardIcon = forwardRef<LayoutDashboardIconHandle, LayoutDashboardIconProps>(
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
          <motion.rect
            animate={controls}
            height="9"
            initial="normal"
            rx="1"
            style={{ originX: "6.5px", originY: "7.5px" }}
            variants={RECT1_VARIANTS}
            width="7"
            x="3"
            y="3"
          />
          <motion.rect
            animate={controls}
            height="5"
            initial="normal"
            rx="1"
            style={{ originX: "17.5px", originY: "5.5px" }}
            variants={RECT2_VARIANTS}
            width="7"
            x="14"
            y="3"
          />
          <motion.rect
            animate={controls}
            height="9"
            initial="normal"
            rx="1"
            style={{ originX: "17.5px", originY: "16.5px" }}
            variants={RECT3_VARIANTS}
            width="7"
            x="14"
            y="12"
          />
          <motion.rect
            animate={controls}
            height="5"
            initial="normal"
            rx="1"
            style={{ originX: "6.5px", originY: "18.5px" }}
            variants={RECT4_VARIANTS}
            width="7"
            x="3"
            y="16"
          />
        </svg>
      </div>
    );
  }
);

LayoutDashboardIcon.displayName = "LayoutDashboardIcon";

export { LayoutDashboardIcon };
