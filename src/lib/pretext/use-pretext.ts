"use client";

/**
 * jalco-ui
 * usePretext hooks
 * by Justin Levine
 * ui.justinlevine.me
 *
 * React hooks wrapping @chenglou/pretext for DOM-free text measurement.
 * Provides prepare/layout lifecycle management, shrinkwrap search,
 * and line-balanced width computation.
 *
 * Powered by Pretext by Cheng Lou — github.com/chenglou/pretext
 */

import * as React from "react";
import type { PreparedTextWithSegments, PrepareOptions } from "@chenglou/pretext";
const isBrowser = typeof window !== "undefined";

function getPretext() {
  return require("@chenglou/pretext") as typeof import("@chenglou/pretext");
}

/**
 * Prepare text with segment data for advanced layout (line-by-line rendering,
 * shrinkwrap, balancing). Same as `usePretext` but returns the richer handle.
 */
export function usePretextWithSegments(
  text: string,
  font: string,
  options?: PrepareOptions
): PreparedTextWithSegments | null {
  const whiteSpace = options?.whiteSpace ?? "normal";

  return React.useMemo(() => {
    if (!isBrowser) return null;
    return getPretext().prepareWithSegments(text, font, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, font, whiteSpace]);
}

/**
 * Find the tightest width that produces the same line count as `maxWidth`.
 * Binary-searches widths using `walkLineRanges` — no DOM measurement.
 *
 * Returns the shrinkwrapped width in pixels.
 */
export function useShrinkwrap(prepared: PreparedTextWithSegments | null, maxWidth: number): number {
  return React.useMemo(() => {
    if (!prepared || maxWidth <= 0) return 0;

    const { walkLineRanges } = getPretext();

    let baseLineCount = 0;
    walkLineRanges(prepared, maxWidth, () => {
      baseLineCount++;
    });
    if (baseLineCount <= 1) {
      let singleLineWidth = 0;
      walkLineRanges(prepared, maxWidth, (line) => {
        singleLineWidth = line.width;
      });
      return Math.ceil(singleLineWidth) || 0;
    }

    let lo = 1;
    let hi = Math.ceil(maxWidth);

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      let midLineCount = 0;
      walkLineRanges(prepared, mid, () => {
        midLineCount++;
      });

      if (midLineCount <= baseLineCount) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    return lo;
  }, [prepared, maxWidth]);
}
