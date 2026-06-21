"use client";

import { useEffect } from "react";

/**
 * Scrolls the element marked `data-focus-id={focusId}` into view and briefly
 * ring-highlights it. Powers "click a summary line item → open its detail list
 * focused on that exact item" across the MyCountry war-room panels.
 *
 * Pass the loaded data in `deps` so the lookup runs once the target row exists.
 */
export function useScrollToFocus(focusId: string | null | undefined, deps: unknown[] = []) {
  useEffect(() => {
    if (!focusId) return;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const escape = window.CSS?.escape ?? ((s: string) => s);
    const mountTimer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-focus-id="${escape(focusId)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const ring = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-lg"];
      el.classList.add(...ring);
      clearTimer = setTimeout(() => el.classList.remove(...ring), 2200);
    }, 180); // let the dialog mount + rows render first
    return () => {
      clearTimeout(mountTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, ...deps]);
}
