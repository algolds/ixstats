// src/components/effects/PageTransitions.tsx
// Page transition animations with glass morph effects

"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

/**
 * Transition variants
 */
export type TransitionVariant = "fade" | "slide" | "scale" | "glass-morph";

/**
 * PageTransition props
 */
export interface PageTransitionProps {
  /** Child elements to animate */
  children: React.ReactNode;
  /** Transition variant */
  variant?: TransitionVariant;
  /** Unique key for AnimatePresence */
  pageKey?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Transition configurations
 */
const TRANSITIONS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },
  slide: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
    transition: { duration: 0.3, ease: [0.4, 0.0, 0.2, 1.0] as any },
  },
  scale: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1.0] as any },
  },
  "glass-morph": {
    initial: { scale: 0.9, opacity: 0, filter: "blur(10px)" },
    animate: { scale: 1, opacity: 1, filter: "blur(0px)" },
    exit: { scale: 0.9, opacity: 0, filter: "blur(10px)" },
    transition: { duration: 0.4, ease: [0.4, 0.0, 0.2, 1.0] as any },
  },
};

/**
 * PageTransition - Animated page transitions
 *
 * Wraps children in motion.div with specified animation
 *
 * @example
 * ```tsx
 * <PageTransition variant="glass-morph" pageKey={pathname}>
 *   <YourPageContent />
 * </PageTransition>
 * ```
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  variant = "fade",
  pageKey,
  className,
}) => {
  const config = TRANSITIONS[variant];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial={config.initial}
        animate={config.animate}
        exit={config.exit}
        transition={config.transition}
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * SharedElementTransition props
 */
export interface SharedElementTransitionProps {
  /** Shared element ID */
  layoutId: string;
  /** Child elements */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SharedElementTransition - Shared element transitions
 *
 * Uses Framer Motion's layoutId for smooth shared element animations
 *
 * @example
 * ```tsx
 * <SharedElementTransition layoutId="card-123">
 *   <CardDisplay card={card} />
 * </SharedElementTransition>
 * ```
 */
export const SharedElementTransition: React.FC<
  SharedElementTransitionProps
> = ({ layoutId, children, className }) => {
  return (
    <motion.div layoutId={layoutId} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * GlassMorphTransition - Specialized glass morph animation
 *
 * Enhanced glass morph effect with backdrop blur
 *
 * @example
 * ```tsx
 * <GlassMorphTransition>
 *   <div>Content with glass effect</div>
 * </GlassMorphTransition>
 * ```
 */
export const GlassMorphTransition: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <motion.div
      initial={{
        scale: 0.9,
        opacity: 0,
        backdropFilter: "blur(0px)",
      }}
      animate={{
        scale: 1,
        opacity: 1,
        backdropFilter: "blur(12px)",
      }}
      exit={{
        scale: 0.9,
        opacity: 0,
        backdropFilter: "blur(0px)",
      }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0.0, 0.2, 1.0] as any,
      }}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5",
        className
      )}
    >
      {children}
    </motion.div>
  );
};
