/** Shared spring and drag constants for the swipeable and slider physics. */

// ── Shared Spring Presets ──────────────────────────────────────────────────

/** Tight, precise spring */
const SPRING_TIGHT = { stiffness: 700, damping: 48, mass: 0.55 } as const;

/** Bouncier spring — responsive and fluid feedback */
const SPRING_BOUNCY = { stiffness: 350, damping: 28, mass: 0.8 } as const;

/** Slow, deliberate spring — for drag-heavy or large UI elements */
const SPRING_GENTLE = { stiffness: 200, damping: 30, mass: 1.0 } as const;

/** Fluid, smooth spring */
const SPRING_FLUID = { stiffness: 500, damping: 38, mass: 0.5 } as const;

export const SPRING_PRESETS = {
  tight: SPRING_TIGHT,
  bouncy: SPRING_BOUNCY,
  gentle: SPRING_GENTLE,
  fluid: SPRING_FLUID,
} as const;

export type SpringPreset = keyof typeof SPRING_PRESETS;

// ── Shared Drag Settings ───────────────────────────────────────────────────

export const DRAG_ELASTICITY = 0.32;
export const DRAG_DEAD_ZONE = 3;
