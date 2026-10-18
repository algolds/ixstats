"use client";

import { useRef, type PointerEvent, type ReactNode, type RefObject } from "react";
import { motion, useSpring } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { springSmooth } from "~/lib/design/motion";

/** Degrees the card leans toward the pointer at its edge. */
const MAX_TILT = 8;
const TILT_SPRING = { stiffness: springSmooth.stiffness, damping: springSmooth.damping };

/**
 * The lean toward the pointer and the holo's light spot, for the two places a card tilts: the sheet's large card and
 * the pack reveal's rare pulls. The handlers go on a wrapper that never tilts, so the lean cannot feed back into the
 * next reading.
 */
export function useCardTilt() {
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);
  const holo = useRef<HTMLSpanElement>(null);
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    rotateY.set((x - 0.5) * 2 * MAX_TILT);
    rotateX.set((0.5 - y) * 2 * MAX_TILT);
    holo.current?.style.setProperty("--holo-x", `${Math.round(x * 100)}%`);
    holo.current?.style.setProperty("--holo-y", `${Math.round(y * 100)}%`);
  };
  const onPointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };
  return { tilt: { rotateX, rotateY }, holo, onPointerMove, onPointerLeave };
}

/** The holo layer over a card face (card-art.css), lit where the pointer is; it never takes a tap. */
export function CardHolo({ holoRef }: { holoRef: RefObject<HTMLSpanElement | null> }) {
  return (
    <span ref={holoRef} aria-hidden="true" className="card-holo rounded-card absolute inset-0" />
  );
}

/** A card that leans toward the pointer and catches the light. Under Reduce Motion it is the card alone. */
export function CardTilt({ children }: { children: ReactNode }) {
  const reduce = useFacetReducedMotion();
  const { tilt, holo, onPointerMove, onPointerLeave } = useCardTilt();
  if (reduce) return <>{children}</>;
  return (
    <div
      className="w-fit perspective-distant"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div style={tilt} className="relative transform-3d">
        {children}
        <CardHolo holoRef={holo} />
      </motion.div>
    </div>
  );
}
