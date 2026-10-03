"use client";

/**
 * The AppSidebar's collapsed state.
 *
 * The source of truth is `data-sidebar="collapsed"` on `<html>`: the pre-paint script
 * (`APPEARANCE_INIT_SCRIPT`, `src/lib/design/appearance.ts`) writes it from localStorage before
 * first paint and the shell's CSS (`src/styles/facet/shell.css`) keys off it. The hook reads the
 * attribute through `useSyncExternalStore`, so on the server and during hydration the value is
 * `null` ("not known yet") and CSS handles the first paint.
 */

import { useCallback, useSyncExternalStore } from "react";
import { NAV_STORAGE_KEYS, applyNavPreferences, readNavPreferences } from "~/lib/design/appearance";

/** Same-document writers notify synchronously; the observer covers anything else touching <html>. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const root = document.documentElement;
  const observer = new MutationObserver(onChange);
  observer.observe(root, { attributes: true, attributeFilter: ["data-sidebar"] });
  // Another tab changed the preference: re-apply it here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === NAV_STORAGE_KEYS.sidebarCollapsed) {
      applyNavPreferences(root, readNavPreferences(NAV_STORAGE_KEYS));
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

const readCollapsed = () => document.documentElement.getAttribute("data-sidebar") === "collapsed";
const unknownOnServer = () => null;

export interface SidebarCollapsedState {
  /** `null` until hydrated; CSS (`sidebar-collapsed:` variant) handles the first paint. */
  collapsed: boolean | null;
  setCollapsed: (collapsed: boolean) => void;
}

export function useSidebarCollapsed(): SidebarCollapsedState {
  const collapsed = useSyncExternalStore<boolean | null>(subscribe, readCollapsed, unknownOnServer);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(NAV_STORAGE_KEYS.sidebarCollapsed, String(next));
    } catch {
      // Storage blocked (private mode): the attribute below still applies for this page view.
    }
    applyNavPreferences(document.documentElement, { sidebarCollapsed: next });
    for (const listener of listeners) listener();
  }, []);
  return { collapsed, setCollapsed };
}
