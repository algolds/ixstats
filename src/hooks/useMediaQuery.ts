"use client";

import { useState, useEffect } from "react";

/**
 * SSR-safe media query hook.
 * Returns `false` during SSR and on first render, then syncs with the actual
 * media query state. Listens for viewport changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
