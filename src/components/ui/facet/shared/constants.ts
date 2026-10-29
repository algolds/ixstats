/** Shared spring and drag constants for the swipeable and slider physics. */

import { springGentle, springMomentum, springSmooth, springSnappy } from "~/lib/design/motion";

// Swipe presets keep their names for SwipeableRow callers but use the motion.ts springs.
const toPreset = ({ stiffness, damping }: { stiffness: number; damping: number }) =>
  ({ stiffness, damping }) as const;

export const SPRING_PRESETS = {
  tight: toPreset(springSnappy),
  bouncy: toPreset(springMomentum),
  gentle: toPreset(springGentle),
  fluid: toPreset(springSmooth),
} as const;

// Shared Drag Settings

export const DRAG_ELASTICITY = 0.32;
export const DRAG_DEAD_ZONE = 3;
