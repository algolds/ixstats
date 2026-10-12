"use client";

import { useSyncExternalStore } from "react";

/** Below this width World Studio shows a notice instead of the tool. */
const STUDIO_MIN_WIDTH = 900;

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** Whether the window is at least `min` px wide; true on the server, which has no window to measure. */
export function useWideScreen(min = STUDIO_MIN_WIDTH): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth >= min,
    () => true
  );
}
