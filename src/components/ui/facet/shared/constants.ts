/**
 * Shared Facet UI Physics and Design Constants
 */

// ── Shared Spring Presets ──────────────────────────────────────────────────

/** Tight, precise spring — matches the apple-switch thumb physics */
export const SPRING_TIGHT = { stiffness: 700, damping: 48, mass: 0.55 } as const;

/** Bouncier spring — responsive and fluid feedback */
export const SPRING_BOUNCY = { stiffness: 350, damping: 28, mass: 0.8 } as const;

/** Slow, deliberate spring — for drag-heavy or large UI elements */
export const SPRING_GENTLE = { stiffness: 200, damping: 30, mass: 1.0 } as const;

/** Fluid, smooth spring — defaults for FacetTabs */
export const SPRING_FLUID = { stiffness: 500, damping: 38, mass: 0.5 } as const;

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

// ── Shared Glass Styling (Tailwind Composition) ────────────────────────────

export const GLASS_BACKING =
  "bg-black/[0.02] dark:bg-gradient-to-br dark:from-white/[0.04] dark:to-white/[0.005]";
export const GLASS_BORDER = "border-black/[0.08] dark:border-white/10";
export const GLASS_BLUR = "backdrop-blur-[20px] saturate-[190%]";
export const GLASS_SHADOW = "shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]";
