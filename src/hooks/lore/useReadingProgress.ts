"use client";

import { useEffect, useState, type RefObject } from "react";
import { readingProgress } from "~/lib/lore/reading";

/**
 * How far through the element the reader has scrolled, 0 to 1, updated at most once a frame while the page scrolls or
 * resizes. It follows the scroll 1:1 (no animation), so there is nothing for Reduce Motion to soften.
 */
export function useReadingProgress(ref: RefObject<HTMLElement | null>, enabled = true): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (el) setProgress(readingProgress(el.getBoundingClientRect(), window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, enabled]);
  return progress;
}
