"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EditPencil, MapPin } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { REDUCED_MOTION_FADE, springSnappy } from "~/lib/design/motion";
import { cn } from "~/lib/utils";

interface EditMorphButtonProps {
  /** Pill plate classes when the button sits over the flag. */
  plate?: string;
  /** Premium: the pill opens into Country | Map. Otherwise it is a plain Edit link. */
  withMapEditor: boolean;
}

const EDITOR_HREF = "/mycountry/editor";
const MAP_EDITOR_HREF = "/mycountry/map-editor";

/**
 * One Edit pill. For premium users it morphs into a Country | Map pair: on hover with a mouse, or
 * on click (touch and keyboard). It closes on mouse leave, Escape or a click outside.
 */
export function EditMorphButton({ plate, withMapEditor }: EditMorphButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLAnchorElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedByKey = useRef(false);
  const closedByEscape = useRef(false);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? REDUCED_MOTION_FADE : springSnappy;

  useEffect(() => {
    if (!open) {
      // Escape hands focus back to the trigger, which remounts as the pill closes.
      if (closedByEscape.current) triggerRef.current?.focus();
      closedByEscape.current = false;
      return;
    }
    // The trigger unmounts as the pill opens, so keyboard focus moves to its first segment.
    if (openedByKey.current) firstRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closedByEscape.current = true;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!withMapEditor) {
    return (
      <Button asChild variant="ghost" className={cn("text-label-secondary", plate)}>
        <Link href={EDITOR_HREF} aria-label="Edit country" title="Edit country">
          <EditPencil aria-hidden="true" />
          <span className="max-md:sr-only">Edit</span>
        </Link>
      </Button>
    );
  }

  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(next);
  };

  return (
    <motion.div
      ref={rootRef}
      layout
      transition={transition}
      role="group"
      aria-label="Editors"
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      // Tabbing out closes it; a null target is the trigger unmounting as the pill opens.
      onBlur={(e) => {
        if (e.relatedTarget && !rootRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
      className={cn("flex items-center overflow-hidden rounded-full", plate)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.div
            key="open"
            className="flex items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <Button asChild variant="ghost" className="text-label-secondary rounded-full">
              <Link ref={firstRef} href={EDITOR_HREF} aria-label="Country editor">
                <EditPencil aria-hidden="true" />
                Country
              </Link>
            </Button>
            <span aria-hidden className="bg-separator h-4 w-px shrink-0" />
            <Button asChild variant="ghost" className="text-label-secondary rounded-full">
              <Link href={MAP_EDITOR_HREF} aria-label="Map editor">
                <MapPin aria-hidden="true" />
                Map
              </Link>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              aria-expanded={false}
              aria-label="Edit country or map"
              onClick={(e) => {
                openedByKey.current = e.detail === 0;
                setOpen(true);
              }}
              className="text-label-secondary rounded-full"
            >
              <EditPencil aria-hidden="true" />
              <span className="max-md:sr-only">Edit</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
