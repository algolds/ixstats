"use client";

import { useMediaQuery } from "./useMediaQuery";

/** Returns true when viewport is below Tailwind's `sm` breakpoint (640px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
