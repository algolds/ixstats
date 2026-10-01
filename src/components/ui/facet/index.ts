export { FacetTabs } from "./tabs";
export type { FacetTabItem, FacetTabsProps } from "./tabs";

// Re-export all swipeable components
export { SwipeableRow, SwipeableGroup, SwipeActionButton } from "./swipeable/SwipeableRow";
export { useSwipePhysics } from "./swipeable/useSwipePhysics";
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
export type {
  FacetMaterialProps,
  FacetMaterialType,
  FacetGlassMaterialType,
  FacetLegacyMaterialType,
} from "./shared/FacetMaterial";

// Hero identity marks (corner flag watermark, tint hairline, glyph watermark)
export { FlagWatermark, TintHairline, WatermarkGlyph } from "./identity/FlagWatermark";

// Facet 3.1 identity layers (spec §16): tint glow blob, refraction hairline, acrylic underlay
export { TintGlow, Refraction, AcrylicGlow } from "./identity/Glow";
export type {
  TintGlowProps,
  TintGlowPosition,
  RefractionProps,
  RefractionEdges,
  AcrylicGlowProps,
} from "./identity/Glow";

// Facet 3.1 HIG: glass never nests (hero-tier glass primitives render opaque inside one another)
export { GlassSurfaceContext, useInsideGlass } from "./shared/nesting";
