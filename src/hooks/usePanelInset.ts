"use client";

import { useEffect, useState, type RefObject } from "react";
import { coveredRight } from "~/lib/maps/panel-inset";

/**
 * Measures how many pixels of `box`'s right side sit under `panel` on mount and whenever either
 * element resizes. Returns 0 when the two do not overlap (stacked phone layout).
 */
export function usePanelInset(
  box: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>
): number {
  const [insetRight, setInsetRight] = useState(0);
  useEffect(() => {
    const measure = () => {
      const next = coveredRight(
        box.current?.getBoundingClientRect() ?? null,
        panel.current?.getBoundingClientRect() ?? null
      );
      setInsetRight((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [box.current, panel.current]) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [box, panel]);
  return insetRight;
}
