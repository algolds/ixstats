import type { Variants, Transition } from "motion/react";

// Directional tab transition variants
export const tabVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
    scale: 0.98,
  }),
};

// Fade-only variant for simpler transitions
export const tabFadeVariants: Variants = {
  enter: {
    opacity: 0,
    y: 10,
  },
  center: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -10,
  },
};

// Spring configuration for natural motion
export const tabSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

// Tween configuration for smoother transitions
export const tabTween: Transition = {
  type: "tween",
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for Apple-like feel
};

// Stagger children configuration
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

// Tab indicator animation
export const indicatorVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
};

// Hover effects for interactive elements
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 400, damping: 17 },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
  },
  transition: { duration: 0.2 },
};

// Card entrance animation
export const cardEntrance: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
};

// Metric counter animation timing
export const counterConfig = {
  duration: 0.8,
  delay: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};
