"use client";

import { useEffect, type PointerEvent } from "react";
import { motionValue, useMotionValue, useSpring } from "motion/react";
import { springSmooth } from "~/lib/design/motion";
import { toUnit } from "~/lib/design/mercury-lens";

/**
 * Shared page-level pointer coordinates (-1..1 across the viewport), so every monogram plane on a
 * page drifts in lockstep as one unified surface instead of starting and stopping per container.
 */
const pagePointerX = motionValue(0);
const pagePointerY = motionValue(0);
let activeSubscribers = 0;
let removeWindowListeners: (() => void) | null = null;

function retainWindowPointerListener(): () => void {
  if (typeof window === "undefined") return () => undefined;
  activeSubscribers += 1;
  if (activeSubscribers === 1) {
    const handleMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const width = window.innerWidth || document.documentElement.clientWidth || 1;
      const height = window.innerHeight || document.documentElement.clientHeight || 1;
      pagePointerX.set(toUnit(event.clientX, 0, width));
      pagePointerY.set(toUnit(event.clientY, 0, height));
    };
    const handleReset = () => {
      pagePointerX.set(0);
      pagePointerY.set(0);
    };
    const handleMouseOut = (event: globalThis.MouseEvent) => {
      if (!event.relatedTarget) handleReset();
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("blur", handleReset);
    window.addEventListener("mouseout", handleMouseOut);
    removeWindowListeners = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("blur", handleReset);
      window.removeEventListener("mouseout", handleMouseOut);
    };
  }
  return () => {
    activeSubscribers = Math.max(0, activeSubscribers - 1);
    if (activeSubscribers === 0 && removeWindowListeners) {
      removeWindowListeners();
      removeWindowListeners = null;
      pagePointerX.set(0);
      pagePointerY.set(0);
    }
  };
}

/**
 * The pointer's place in the viewport, -1 to 1 on each axis, sprung (`springSmooth`), shared across
 * the page so every Lens monogram backdrop drifts seamlessly as one plane. Mouse only: touch has no
 * hover to follow. Off under Reduce Motion or when disabled; leaving the window or disabling
 * recentres it.
 */
export function usePointerParallax(reduceMotion: boolean) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, springSmooth);
  const py = useSpring(pointerY, springSmooth);

  useEffect(() => {
    if (reduceMotion) {
      pointerX.set(0);
      pointerY.set(0);
      return;
    }
    pointerX.set(pagePointerX.get());
    pointerY.set(pagePointerY.get());
    const unsubX = pagePointerX.on("change", (v) => pointerX.set(v));
    const unsubY = pagePointerY.on("change", (v) => pointerY.set(v));
    const release = retainWindowPointerListener();
    return () => {
      unsubX();
      unsubY();
      release();
    };
  }, [reduceMotion, pointerX, pointerY]);

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || reduceMotion) return;
    const width =
      (typeof window !== "undefined" && window.innerWidth) ||
      event.currentTarget.getBoundingClientRect().width ||
      1;
    const height =
      (typeof window !== "undefined" && window.innerHeight) ||
      event.currentTarget.getBoundingClientRect().height ||
      1;
    pagePointerX.set(toUnit(event.clientX, 0, width));
    pagePointerY.set(toUnit(event.clientY, 0, height));
  };
  const onPointerLeave = () => {
    pagePointerX.set(0);
    pagePointerY.set(0);
  };

  return { px, py, onPointerMove, onPointerLeave };
}
