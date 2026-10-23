"use client";

import type { PointerEvent } from "react";
import { useSpring } from "motion/react";
import { springSmooth } from "~/lib/design/motion";

/** Pixels the map face slides across the card, at most in each direction (half the range either way). */
const DRIFT_X = 12;
const DRIFT_Y = 8;
const DRIFT_SPRING = { stiffness: springSmooth.stiffness, damping: springSmooth.damping };

/**
 * The map face's slow slide against the pointer, so it reads as a window onto a larger map. The handlers go on the
 * card, which never moves; touch and pen are ignored because they have no hover to follow.
 */
export function useMapDrift() {
  const x = useSpring(0, DRIFT_SPRING);
  const y = useSpring(0, DRIFT_SPRING);
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    x.set((0.5 - px) * DRIFT_X);
    y.set((0.5 - py) * DRIFT_Y);
  };
  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };
  return { drift: { x, y }, onPointerMove, onPointerLeave };
}
