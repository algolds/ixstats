"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

/** What an open popover (the persona list, the action picker) is: focus there is still the composer's. */
const OPEN_POPOVER =
  '[role="menu"], [role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper]';

/**
 * Whether the phone dock's composer is folded to its one-line bar: docked, with nothing typed, no reply or error to
 * show, and focus outside it. Focus moving to the composer's own controls or an open popover does not fold it.
 * The editor stays mounted either way (only its surroundings change), so a draft survives folding and unfolding.
 */
export function useDockCollapse(docked: boolean, hasContent: boolean, busy: boolean) {
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onFocusCapture = useCallback(() => {
    clearTimeout(timer.current);
    setFocused(true);
  }, []);
  const onBlurCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    const surface = event.currentTarget;
    clearTimeout(timer.current);
    // Focus lands on its next element after the blur: ask then where it went.
    timer.current = setTimeout(() => {
      const active = document.activeElement;
      const within = active !== null && (surface.contains(active) || active.closest(OPEN_POPOVER));
      if (!within) setFocused(false);
    }, 0);
  }, []);

  return {
    collapsed: docked && !focused && !hasContent && !busy,
    surface: { onFocusCapture, onBlurCapture },
  };
}
