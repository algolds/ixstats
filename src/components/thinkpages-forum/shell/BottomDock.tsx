"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "~/lib/utils/cn";

/** The docked bar's measured height, on the document, for `DockSpacer` to leave room for. */
const DOCK_HEIGHT = "--forum-dock-height";
/** Until the dock has been measured: what a short docked editor takes. */
const FALLBACK_HEIGHT = "10rem";

/** Above the tab bar on phones, on the shell's own offset, as the chrome material the shell's other bars are. */
const DOCKED =
  "facet-chrome text-label rounded-sheet z-chrome fixed inset-x-2 bottom-[calc(var(--shell-tabbar-height)+0.5rem)] p-2";

interface BottomDockProps {
  /** Docked above the tab bar (phones); otherwise the children sit in the page where this is rendered. */
  docked: boolean;
  /** The `data-slot` of the docked bar. */
  slot: string;
  children: ReactNode;
}

/**
 * The phone dock the board's composer and a thread's reply bar share. The wrapper is always rendered and only its
 * classes change, so what is inside it (a draft in an editor) is not remounted when the viewport crosses the phone
 * breakpoint. While docked it reports its real height, which the editor, a reply chip or an error can change at any
 * time, so `DockSpacer` keeps the end of the page clear of it.
 */
export function BottomDock({ docked, slot, children }: BottomDockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!docked || !element) return;
    const root = document.documentElement;
    const measure = () =>
      root.style.setProperty(DOCK_HEIGHT, `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(DOCK_HEIGHT);
    };
  }, [docked]);

  return (
    <div
      ref={ref}
      data-slot={docked ? slot : undefined}
      className={cn(docked ? DOCKED : "contents")}
    >
      {children}
    </div>
  );
}

/** Room at the end of the page, as tall as the dock is now, so the last messages are not hidden behind it. */
export function DockSpacer() {
  return (
    <div
      aria-hidden
      data-slot="dock-spacer"
      style={{ height: `calc(var(${DOCK_HEIGHT}, ${FALLBACK_HEIGHT}) + 1rem)` }}
    />
  );
}
