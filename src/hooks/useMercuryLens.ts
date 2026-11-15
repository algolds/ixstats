"use client";

import { useRef, type PointerEvent } from "react";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import { springMomentum } from "~/lib/design/motion";
import {
  dragDeform,
  hoverDeform,
  pressDeform,
  REST,
  toUnit,
  type LensDeform,
} from "~/lib/design/mercury-lens";

/** A press on these is theirs (follow the link, open the menu), never a grab of the glass. */
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, [role=button], [role=menuitem], [role=tab], [contenteditable]";

interface Grab {
  id: number;
  x0: number;
  y0: number;
  origin: { x: number; y: number };
  lx: number;
  ly: number;
  lt: number;
}

/**
 * Liquid-mercury surface tension for the front page hero's Lens (cards never move; `LensCard` drifts
 * only its backdrop): a volume-keeping squish on press, a 1:1 rubber-banded
 * pull with a stretch along the faster axis, a lean toward a resting mouse, and an under-damped
 * settle (`springMomentum`). `lensStyle` goes on the glass; `contentStyle` on content beside it,
 * which moves at about two thirds of the glass so the two read as liquid, not one slab. Off under
 * Reduce Motion.
 */
export function useMercuryLens(reduceMotion: boolean) {
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const targetScaleX = useMotionValue(1);
  const targetScaleY = useMotionValue(1);

  const lensX = useSpring(targetX, springMomentum);
  const lensY = useSpring(targetY, springMomentum);
  const lensScaleX = useSpring(targetScaleX, springMomentum);
  const lensScaleY = useSpring(targetScaleY, springMomentum);

  const contentX = useTransform(lensX, (v) => v * 0.65);
  const contentY = useTransform(lensY, (v) => v * 0.65);
  const contentScaleX = useTransform(lensScaleX, (v) => 1 + (v - 1) * 0.45);
  const contentScaleY = useTransform(lensScaleY, (v) => 1 + (v - 1) * 0.45);

  const grabRef = useRef<Grab | null>(null);

  const setDeform = ({ x, y, sx }: LensDeform) => {
    targetX.set(x);
    targetY.set(y);
    targetScaleX.set(sx);
    targetScaleY.set(1 / sx);
  };

  const reset = () => {
    grabRef.current = null;
    setDeform(REST);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (reduceMotion || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    const press = pressDeform(
      toUnit(event.clientX, box.left, box.width),
      toUnit(event.clientY, box.top, box.height)
    );
    grabRef.current = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      origin: { x: press.x, y: press.y },
      lx: event.clientX,
      ly: event.clientY,
      lt: performance.now(),
    };
    setDeform(press);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const grab = grabRef.current;
    if (grab && grab.id === event.pointerId) {
      const now = performance.now();
      const dt = Math.max(now - grab.lt, 8);
      const vx = ((event.clientX - grab.lx) / dt) * 1000;
      const vy = ((event.clientY - grab.ly) / dt) * 1000;
      grab.lx = event.clientX;
      grab.ly = event.clientY;
      grab.lt = now;
      setDeform(dragDeform(grab.origin, event.clientX - grab.x0, event.clientY - grab.y0, vx, vy));
      return;
    }
    if (event.pointerType === "mouse") {
      const box = event.currentTarget.getBoundingClientRect();
      setDeform(
        hoverDeform(
          toUnit(event.clientX, box.left, box.width),
          toUnit(event.clientY, box.top, box.height)
        )
      );
    }
  };

  return {
    lensStyle: { x: lensX, y: lensY, scaleX: lensScaleX, scaleY: lensScaleY },
    contentStyle: { x: contentX, y: contentY, scaleX: contentScaleX, scaleY: contentScaleY },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: reset,
      onPointerCancel: reset,
      onLostPointerCapture: reset,
      onPointerLeave: () => {
        if (!grabRef.current) reset();
      },
    },
  };
}
