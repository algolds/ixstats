"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flip } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
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

/** A key pressed in a dialog stacked over the card (or a popover beside it) belongs to that layer. */
function inOtherDialog(target: EventTarget | null, own: Element | null): boolean {
  const dialog = target instanceof Element ? target.closest(DIALOG) : null;
  return dialog !== null && dialog !== (own?.closest(DIALOG) ?? null);
}

/** A held copy's turn: its back, the side that shows, and how to turn it. */
interface CardTurn {
  back: ReactNode;
  flipped: boolean;
  onFlip: () => void;
}

interface CardFlipProps {
  face: CardFaceData;
  /** Null for a card the viewer holds no copy of: only a copy has a back, so the card does not turn. */
  turn: CardTurn | null;
}

/** The corner's hint that a tap turns the card; Space and F are named by the card's label. */
function TurnHint() {
  return (
    <span
      data-slot="turn-hint"
      aria-hidden
      className="pointer-events-none absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white"
    >
      <Flip className="size-4" />
    </span>
  );
}

/**
 * The sheet's large card: it leans toward the pointer, a Foil, Holo or Serialised copy catches the light, and a held
 * copy turns over when tapped or on Space or F. Under Reduce Motion there is no tilt and no holo, and the sides
 * cross-fade.
 */
export function CardFlip({ face, turn }: CardFlipProps) {
  const reduce = useFacetReducedMotion();
  const { tilt, holo, onPointerMove, onPointerLeave } = useCardTilt();
  const root = useRef<HTMLDivElement>(null);
  const onFlip = turn?.onFlip;
  const flipped = turn?.flipped === true;

  useEffect(() => {
    if (!onFlip) return;
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
  const shell = {
    ref: root,
    tabIndex: -1,
    onClick: onFlip,
    className: cn("relative mx-auto w-fit max-w-full outline-none", turn && "cursor-pointer"),
  };

  if (reduce) {
    return (
      <div {...shell} className={cn(shell.className, "grid grid-cols-1")}>
        <AnimatePresence initial={false}>
          <motion.div
            key={flipped ? "back" : "front"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: tweenExit }}
            transition={REDUCED_MOTION_FADE}
            className="col-start-1 row-start-1"
          >
            {flipped ? turn?.back : front}
          </motion.div>
        </AnimatePresence>
        {turn && <TurnHint />}
      </div>
    );
  }

  return (
    <div
      {...shell}
      className={cn(shell.className, "perspective-distant")}
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
          {turn && (
            <div className="absolute inset-0 rotate-y-180 backface-hidden" inert={!flipped}>
              {turn.back}
            </div>
          )}
        </motion.div>
      </motion.div>
      {turn && <TurnHint />}
    </div>
  );
}
