"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Hero collapse state for MyCountry, persisted per country in localStorage.
 *
 * - v2 defaults to COLLAPSED (actions-first); v1 defaults to expanded.
 * - Once the user expands/collapses, that choice is stored and honored on the
 *   next visit. Storage failures are swallowed (feature degrades gracefully).
 *
 * Shared by SectionShell (v1/overview) and the v2 command surface so the
 * collapsed-by-default + persistence behavior stays consistent across surfaces.
 */
export function useHeroCollapsed(v2: boolean, countryId?: string) {
  const storageKey = `ixstats:mycountry:hero:${countryId ?? "none"}`;
  const storedPrefRef = useRef(false);

  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return v2;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) {
        storedPrefRef.current = true;
        return stored === "1";
      }
    } catch {
      /* ignore storage errors */
    }
    return v2;
  });

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore storage errors */
      }
    },
    [storageKey]
  );

  return { collapsed, setCollapsed, hasStoredPref: storedPrefRef.current };
}