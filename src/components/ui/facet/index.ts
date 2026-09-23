export { FacetTabs } from "./tabs";
export type { FacetTabItem, FacetTabsProps } from "./tabs";

// Re-export all swipeable components
export { SwipeableRow, SwipeableGroup, SwipeActionButton } from "./swipeable/SwipeableRow";
export { useSwipePhysics } from "./swipeable/useSwipePhysics";
export { useSwipeableDI } from "./swipeable/useSwipeableDI";
export type {
  SwipeableRowProps,
  SwipeAction,
  SwipeCommitAction,
  SwipeThresholds,
  SwipeState,
  SwipeSide,
  SpringPreset,
} from "./swipeable/types";

// Export shared slider physics hook
export { useSliderPhysics } from "./hooks/useSliderPhysics";
export type { SliderBounds, UseSliderPhysicsOptions } from "./hooks/useSliderPhysics";

// Export physical materials components and types
export { FacetMaterial } from "./shared/FacetMaterial";
export type { FacetMaterialProps, FacetMaterialType } from "./shared/FacetMaterial";
