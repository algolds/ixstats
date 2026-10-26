"use client";

import { useEffect, useState, type RefObject } from "react";

/** How close to the viewport an element counts as near: a screen or so ahead, so it is ready as it scrolls in. */
const NEAR_MARGIN = "800px 0px";

/**
 * Whether the element has come near the viewport; once it has, it stays true (what was loaded for it is kept). A
 * browser without IntersectionObserver counts everything as near.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: NEAR_MARGIN }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, near]);

  return near;
}
