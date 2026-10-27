"use client";

import { useEffect, useState, type RefObject } from "react";

/** An embed builds its map once it is this close to the viewport (so the map is there as it scrolls in). */
const BUILD_MARGIN = "200px";
/** It keeps the map until it is more than one viewport away, above or below. Wider than the build margin so a
 * scroll that hovers at the edge does not build and remove the map over and over. */
const KEEP_MARGIN = "100% 0px";

/**
 * Whether an embed should hold a map. Browsers allow about 16 WebGL contexts per page, so a long article of
 * embeds cannot keep one each: the map is built near the viewport and released far from it.
 */
export function useEmbedInRange(ref: RefObject<HTMLElement | null>): boolean {
  const [inRange, setInRange] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.at(-1)?.isIntersecting) setInRange(true);
      },
      { rootMargin: BUILD_MARGIN }
    );
    const keep = new IntersectionObserver(
      (entries) => {
        if (entries.at(-1)?.isIntersecting === false) setInRange(false);
      },
      { rootMargin: KEEP_MARGIN }
    );
    near.observe(element);
    keep.observe(element);
    return () => {
      near.disconnect();
      keep.disconnect();
    };
  }, [ref]);

  return inRange;
}
