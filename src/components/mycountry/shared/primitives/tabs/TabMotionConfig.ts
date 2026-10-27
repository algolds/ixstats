import type { Variants } from "motion/react";

// Directional tab transition variants
// Fade-only variant for simpler transitions
// Spring configuration for natural motion
// Tween configuration for smoother transitions
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
      damping: 32,
    },
  },
};

// Tab indicator animation
// Press feedback for interactive elements: compression, no hover growth
// Card entrance animation
// Metric counter animation timing
