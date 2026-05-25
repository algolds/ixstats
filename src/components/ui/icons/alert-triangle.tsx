"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "~/lib/utils";

export interface AlertTriangleIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface AlertTriangleIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const TRIANGLE_VARIANTS: Variants = {
  normal: {
    translateX: 0,
  },
  animate: {
    translateX: [-2, 2, -1, 1, 0],
    transition: {
      duration: 0.4,
      ease: "easeInOut",
    },
  },
};

const EXCLAMATION_VARIANTS: Variants = {
  normal: {
    opacity: 1,
  },
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 0.3,
      delay: 0.15,
      ease: "easeInOut",
    },
  },
};

const AlertTriangleIcon = forwardRef<AlertTriangleIconHandle, AlertTriangleIconProps>(
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
          strokeWidth="2"
          variants={TRIANGLE_VARIANTS}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Triangle */}
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          {/* Exclamation line */}
          <motion.path
            animate={controls}
            d="M12 9v4"
            initial="normal"
            variants={EXCLAMATION_VARIANTS}
          />
          {/* Exclamation dot */}
          <motion.path
            animate={controls}
            d="M12 17h.01"
            initial="normal"
            variants={EXCLAMATION_VARIANTS}
          />
        </motion.svg>
      </div>
    );
  }
);

AlertTriangleIcon.displayName = "AlertTriangleIcon";

export { AlertTriangleIcon };
