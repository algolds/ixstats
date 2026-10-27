"use client";
/**
 * Which apps and admin groups are open in the source list. Read after mount, so the server and
 * the first client render show only the current app open (the current app is always open and is
 * not stored). Synced across tabs.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV_STORAGE_KEYS } from "~/lib/design/appearance";

function readExpanded(): Set<string> {
  try {
    const raw = window.localStorage.getItem(NAV_STORAGE_KEYS.expanded);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
    );
  } catch {
    return new Set();
  }
}

export function useNavExpanded(): { expanded: ReadonlySet<string>; toggle: (id: string) => void } {
  const [expanded, setExpandedState] = useState<ReadonlySet<string>>(() => new Set());
  // The latest set, so toggle can compute the next one (and write it) outside a state updater:
  // updaters must stay pure, and React runs them twice in StrictMode.
  const latest = useRef<ReadonlySet<string>>(expanded);
  const setExpanded = useCallback((next: ReadonlySet<string>) => {
    latest.current = next;
    setExpandedState(next);
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line
    setExpanded(readExpanded());
    const onStorage = (event: StorageEvent) => {
      if (event.key === NAV_STORAGE_KEYS.expanded) setExpanded(readExpanded());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setExpanded]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(latest.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(NAV_STORAGE_KEYS.expanded, JSON.stringify([...next]));
      } catch {
        // Storage blocked: the state still holds for this session.
      }
      setExpanded(next);
    },
    [setExpanded]
  );

  return { expanded, toggle };
}
