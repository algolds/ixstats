/**
 * Glass SwipeableRow — Physics & Configuration Constants
 *
 * Spring presets are derived from the apple-switch component
 * (src/components/unlumen-ui/apple-switch.tsx) to maintain a consistent
 * interaction feel across the glass design system.
 */

// ── Spring Presets ──────────────────────────────────────────────────────

import {
  SPRING_TIGHT,
  SPRING_BOUNCY,
  SPRING_GENTLE,
  SPRING_FLUID,
  SPRING_PRESETS as SHARED_SPRING_PRESETS,
} from "../shared/constants";

export { SPRING_TIGHT, SPRING_BOUNCY, SPRING_GENTLE, SPRING_FLUID };

export const SPRING_PRESETS = SHARED_SPRING_PRESETS;

// ── Default Snap Thresholds (percentage of container width, 0-1) ────────

export const DEFAULT_THRESHOLDS = {
  /** Swipe 20% to reveal action buttons */
  reveal: 0.2,
  /** Swipe 50% to emphasize the primary action */
  emphasize: 0.5,
  /** Swipe 85% to commit (execute the action) */
  commit: 0.85,
} as const;

// ── Velocity Thresholds (px/s) ──────────────────────────────────────────

/** Fast flick velocity that auto-commits the full-swipe action */
export const VELOCITY_COMMIT = 800;

/** Fast flick velocity that reveals the action tray */
export const VELOCITY_REVEAL = 300;

// ── Visual Haptic Constants ─────────────────────────────────────────────

/** Scale applied to the row when hitting a snap point (subtle "click" feel) */
export const HAPTIC_SCALE_BOUNCE = 0.96;

/** Overshoot scale for rubber-band effect at snap boundaries */
export const HAPTIC_OVERSHOOT = 1.03;

/** Scale during the gulp commit animation before height collapse */
export const GULP_SCALE = 0.96;

/** Duration of the color flood phase during gulp (ms) */
export const GULP_FLOOD_DURATION = 200;

/** Duration of the icon pulse phase during gulp (ms) */
export const GULP_ICON_PULSE_DURATION = 300;

// ── Drag Thresholds ─────────────────────────────────────────────────────

import {
  DRAG_DEAD_ZONE as SHARED_DRAG_DEAD_ZONE,
  DRAG_ELASTICITY as SHARED_DRAG_ELASTICITY,
} from "../shared/constants";

/** Minimum px of drag movement before we consider it a swipe (prevents tap conflicts) */
export const DRAG_DEAD_ZONE = SHARED_DRAG_DEAD_ZONE;

/** Drag elasticity past the commit threshold (rubber-band resistance) */
export const DRAG_ELASTICITY = SHARED_DRAG_ELASTICITY;
