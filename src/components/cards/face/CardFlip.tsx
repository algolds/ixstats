"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useSpring } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { REDUCED_MOTION_FADE, springSmooth, tweenExit } from "~/lib/design/motion";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CardFace } from "./CardFace";

/** Degrees the card leans toward the pointer at its edge. */
const MAX_TILT = 8;
const TILT_SPRING = { stiffness: springSmooth.stiffness, damping: springSmooth.damping };

/** Where keys belong to the focused widget: text entry, and lists that search as you type. */
const TYPING_TARGET = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='menu']",
].join(", ");

/** Controls that Space presses or toggles. */
const SPACE_CONTROL = [
  "button",
  "a[href]",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
].join(", ");

/** Space or F flips the card, unless the user is typing or Space would press another control. */
export function isFlipKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(TYPING_TARGET)) return false;
  if (event.key === "f" || event.key === "F") return true;
  return event.key === " " && !target?.closest(SPACE_CONTROL);
}

interface CardFlipProps {
  face: CardFaceData;
  back: ReactNode;
  flipped: boolean;
  onFlip: () => void;
}

/**
 * The sheet's large card: it leans toward the pointer, a Foil, Holo or Serialised copy catches the light, and Space or F
 * turns it over. Under Reduce Motion there is no tilt and no holo, and the sides cross-fade.
 */
export function CardFlip({ face, back, flipped, onFlip }: CardFlipProps) {
  const reduce = useFacetReducedMotion();
  const tiltX = useSpring(0, TILT_SPRING);
  const tiltY = useSpring(0, TILT_SPRING);
  const holo = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isFlipKey(event)) return;
      event.preventDefault();
      onFlip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFlip]);

  // Measured on the wrapper, which never tilts, so the lean cannot feed back into the next reading.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    tiltY.set((x - 0.5) * 2 * MAX_TILT);
    tiltX.set((0.5 - y) * 2 * MAX_TILT);
    holo.current?.style.setProperty("--holo-x", `${Math.round(x * 100)}%`);
    holo.current?.style.setProperty("--holo-y", `${Math.round(y * 100)}%`);
  };
  const onPointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  const showHolo = !reduce && face.copy !== null && face.copy.finish !== "STANDARD";
  const front = (
    <span className="relative block">
      <CardFace face={face} size="L" />
      {showHolo && (
        <span ref={holo} aria-hidden="true" className="card-holo rounded-card absolute inset-0" />
      )}
    </span>
  );

  if (reduce) {
    return (
      <div className="mx-auto grid w-fit">
        <AnimatePresence initial={false}>
          <motion.div
            key={flipped ? "back" : "front"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: tweenExit }}
            transition={REDUCED_MOTION_FADE}
            className="col-start-1 row-start-1"
          >
            {flipped ? back : front}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-fit perspective-distant"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div style={{ rotateX: tiltX, rotateY: tiltY }} className="transform-3d">
        <motion.div
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={springSmooth}
          className="relative transform-3d"
        >
          <div className="backface-hidden" inert={flipped}>
            {front}
          </div>
          <div className="absolute inset-0 rotate-y-180 backface-hidden" inert={!flipped}>
            {back}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
