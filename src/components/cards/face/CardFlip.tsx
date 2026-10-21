"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { REDUCED_MOTION_FADE, springSmooth, tweenExit } from "~/lib/design/motion";
import type { CardFaceData } from "~/lib/cards/face/types";
import { CardFace } from "./CardFace";
import { CardHolo, useCardTilt } from "./CardTilt";

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

const DIALOG = "[role='dialog'], [role='alertdialog']";

/** Space or F aimed at the card, repeats included: not typed, not handled, and Space not on another control. */
function aimsAtCard(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(TYPING_TARGET)) return false;
  if (event.key === "f" || event.key === "F") return true;
  return event.key === " " && !target?.closest(SPACE_CONTROL);
}

/** Space or F flips the card, unless the user is typing or Space would press another control. */
export function isFlipKey(event: KeyboardEvent): boolean {
  return !event.repeat && aimsAtCard(event);
}

/** A key pressed in a dialog stacked over the card (or a popover beside it) belongs to that layer. */
function inOtherDialog(target: EventTarget | null, own: Element | null): boolean {
  const dialog = target instanceof Element ? target.closest(DIALOG) : null;
  return dialog !== null && dialog !== (own?.closest(DIALOG) ?? null);
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
  const { tilt, holo, onPointerMove, onPointerLeave } = useCardTilt();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const own = root.current;
      if (!aimsAtCard(event) || inOtherDialog(event.target, own)) return;
      // A held key flips once, but its repeats are still claimed so a held Space cannot scroll the sheet.
      event.preventDefault();
      if (event.repeat) return;
      // The side turning away goes inert (or unmounts), which would drop its focus to the body.
      if (own && event.target instanceof Node && own.contains(event.target)) {
        own.focus({ preventScroll: true });
      }
      onFlip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFlip]);

  const showHolo = !reduce && face.copy !== null && face.copy.finish !== "STANDARD";
  // max-w-full: on a narrow phone the card shrinks into its column, its 5:7 ratio setting the height.
  const front = (
    <span className="relative block">
      <CardFace face={face} size="L" className="max-w-full" />
      {showHolo && <CardHolo holoRef={holo} />}
    </span>
  );

  if (reduce) {
    return (
      <div
        ref={root}
        tabIndex={-1}
        className="mx-auto grid w-fit max-w-full grid-cols-1 outline-none"
      >
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
      ref={root}
      tabIndex={-1}
      className="mx-auto w-fit max-w-full outline-none perspective-distant"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div style={tilt} className="transform-3d">
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
