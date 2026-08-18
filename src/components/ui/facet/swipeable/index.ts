/**
 * Glass SwipeableRow — Barrel Exports
 *
 * @example
 * import { SwipeableRow, SwipeableGroup, SwipeActionButton } from '~/components/ui/facet/swipeable';
 * import { useSwipeableDI } from '~/components/ui/facet/swipeable';
 */

// Core components
export { SwipeableRow, SwipeableGroup, SwipeActionButton } from "./SwipeableRow";

// Physics hook (reusable for other glass primitives)
export { useSwipePhysics } from "./useSwipePhysics";
export type { SwipePhysicsResult } from "./useSwipePhysics";

// DynamicIsland integration hook
export { useSwipeableDI } from "./useSwipeableDI";

// Constants
export {
  SPRING_TIGHT,
  SPRING_BOUNCY,
  SPRING_GENTLE,
  SPRING_PRESETS,
  DEFAULT_THRESHOLDS,
} from "./constants";

// Types
export type {
  SwipeableRowProps,
  SwipeAction,
  SwipeCommitAction,
  SwipeThresholds,
  SwipeState,
  SwipeSide,
  SpringPreset,
  SwipeableGroupContextValue,
  SwipeActionButtonProps,
  SwipeableRowLeadingProps,
  SwipeableRowTrailingProps,
  SwipeableRowContentProps,
  SwipeableRowExpandedProps,
} from "./types";
