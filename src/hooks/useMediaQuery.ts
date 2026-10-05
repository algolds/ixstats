"use client";

import { useCallback, useSyncExternalStore } from "react";

const serverSnapshot = () => false;

/**
 * SSR-safe media query hook. `false` on the server and while hydrating; on a client-only render it
 * reads the real match synchronously, so a component that mounts already wide (or narrow) never
 * flashes the other layout or fires a spurious "crossed a breakpoint" change. Listens for viewport
 * changes.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
