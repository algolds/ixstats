"use client";

import type { PointerEvent } from "react";
import { useMotionValue, useSpring } from "motion/react";
import { springSmooth } from "~/lib/design/motion";
import { toUnit } from "~/lib/design/mercury-lens";

/**
 * The pointer's place in a box, -1 to 1 on each axis, sprung (`springSmooth`), for a Lens backdrop
 * that drifts against the mouse in depth planes (the hero's monogram, `LensCard`). Mouse only: touch
 * has no hover to follow. Off under Reduce Motion; leaving the box recentres it.
 */
export function usePointerParallax(reduceMotion: boolean) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, springSmooth);
  const py = useSpring(pointerY, springSmooth);

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(toUnit(event.clientX, box.left, box.width));
    pointerY.set(toUnit(event.clientY, box.top, box.height));
  };
  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return { px, py, onPointerMove, onPointerLeave };
}
