"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

export const LONG_PRESS_MS = 450;

/**
 * Calls `onLongPress` when the primary pointer stays down for `delayMs`. `consume()` tells the click that ends such a
 * press so it can skip its ordinary action: it returns true once, for the press that fired. A press whose click never
 * comes (the pointer left, or was cancelled) is forgotten at once, and one that ended on the button is forgotten on
 * the next tick, so a later keyboard activation is never swallowed.
 */
export function useLongPress(onLongPress: () => void, delayMs: number = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forget = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  useEffect(() => {
    callback.current = onLongPress;
  });

  const clear = useCallback((handle: typeof timer) => {
    if (handle.current !== null) {
      clearTimeout(handle.current);
      handle.current = null;
    }
  }, []);
  useEffect(
    () => () => {
      clear(timer);
      clear(forget);
    },
    [clear]
  );

  const start = useCallback(
    (event: PointerEvent) => {
      if (event.button > 0) return;
      clear(forget);
      clear(timer);
      fired.current = false;
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        callback.current();
      }, delayMs);
    },
    [clear, delayMs]
  );

  /** The press ended on the button: its click, if any, follows in this task. */
  const end = useCallback(() => {
    clear(timer);
    if (!fired.current) return;
    clear(forget);
    forget.current = setTimeout(() => {
      forget.current = null;
      fired.current = false;
    }, 0);
  }, [clear]);

  /** The press left the button: no click will follow. */
  const abandon = useCallback(() => {
    clear(timer);
    fired.current = false;
  }, [clear]);

  const consume = useCallback((): boolean => {
    const was = fired.current;
    fired.current = false;
    return was;
  }, []);

  return {
    handlers: {
      onPointerDown: start,
      onPointerUp: end,
      onPointerLeave: abandon,
      onPointerCancel: abandon,
    },
    consume,
  };
}
