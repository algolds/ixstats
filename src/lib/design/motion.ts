/**
 * Motion tokens for `motion/react`.
 *
 * CSS mirrors: `--spring-*-stiffness` / `--spring-*-damping`, `--duration-fast`, `--duration-exit`
 * and `--ease-out-facet` in `src/styles/facet/tokens.css` (utilities `duration-fast`,
 * `duration-exit`, `ease-out-facet`).
 *
 * Rules: animate transform and opacity only; enter from `scale(0.96)` + opacity 0; press
 * `scale(0.98)`; keyboard-invoked UI appears in 0ms; exits are faster than entrances.
 * Under Reduce Motion, use `REDUCED_MOTION_FADE` instead of a spring.
 */

import type { Transition } from "motion/react";

/** Controls: switch thumbs, segmented selection, toggles, press release. */
export const springSnappy = { type: "spring", stiffness: 520, damping: 38 } as const satisfies Transition;

/** Sheets, sidebar, navigation, layout changes. */
export const springSmooth = { type: "spring", stiffness: 320, damping: 32 } as const satisfies Transition;

/** Emphasis: success states, reveals. */
export const springGentle = { type: "spring", stiffness: 180, damping: 24 } as const satisfies Transition;
/** `cubic-bezier(.23, 1, .32, 1)` — colour and opacity changes. */
export const EASE_OUT_FACET = [0.23, 1, 0.32, 1] as const;

/** Durations in seconds (motion/react units). */
export const DURATION_FAST = 0.15;
export const DURATION_EXIT = 0.12;

/** Colour/opacity tween. */
export const tweenFast = {
  type: "tween",
  duration: DURATION_FAST,
  ease: EASE_OUT_FACET,
} as const satisfies Transition;

/** Exit tween (always faster than the entrance). */
export const tweenExit = {
  type: "tween",
  duration: DURATION_EXIT,
  ease: EASE_OUT_FACET,
} as const satisfies Transition;

/** Reduce Motion: springs become 150ms cross-fades. */
export const REDUCED_MOTION_FADE = tweenFast;

/** Entrance start / press compression values. */
export const ENTER_SCALE = 0.96;
export const PRESS_SCALE = 0.98;
