"use client";

/**
 * The `facet-nav` flag and the AppSidebar's collapsed state (Facet 3 spec §7.4, Phase 3).
 *
 * The source of truth is on `<html>`: the pre-paint script (`APPEARANCE_INIT_SCRIPT`,
 * `src/lib/design/appearance.ts`) writes `data-nav="facet"` and `data-sidebar="collapsed"` from
 * localStorage (falling back to `NEXT_PUBLIC_FACET_NAV`) before first paint, and the shell's CSS
 * (`src/styles/facet/shell.css`) keys off those attributes. These hooks read the attributes through
 * `useSyncExternalStore`, so:
 *
 * - on the server and during hydration the value is `null` ("not known yet") — callers render both
 *   shells and let CSS show the right one, so the server HTML and the first client render agree;
 * - right after hydration the real value arrives and callers unmount the inactive shell.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  FACET_NAV_DEFAULT,
  NAV_STORAGE_KEYS,
  applyNavPreferences,
  readNavPreferences,
} from "~/lib/design/appearance";

const ATTRIBUTES = ["data-nav", "data-sidebar"];

/** Same-document writers notify synchronously; the observer covers anything else touching <html>. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const root = document.documentElement;
  const observer = new MutationObserver(onChange);
  observer.observe(root, { attributes: true, attributeFilter: ATTRIBUTES });
  // Another tab changed the preference: re-apply it here too.
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === NAV_STORAGE_KEYS.facetNav ||
      event.key === NAV_STORAGE_KEYS.sidebarCollapsed
    ) {
      applyNavPreferences(root, readNavPreferences(NAV_STORAGE_KEYS, FACET_NAV_DEFAULT));
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

const readFacetNav = () => document.documentElement.getAttribute("data-nav") === "facet";
const readCollapsed = () => document.documentElement.getAttribute("data-sidebar") === "collapsed";
const unknownOnServer = () => null;

function persist(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked (private mode): the attribute below still applies for this page view.
  }
}

function writeAttributes(patch: { facetNav?: boolean; sidebarCollapsed?: boolean }): void {
  applyNavPreferences(document.documentElement, {
    facetNav: patch.facetNav ?? readFacetNav(),
    sidebarCollapsed: patch.sidebarCollapsed ?? readCollapsed(),
  });
  for (const listener of listeners) listener();
}

export interface FacetNavState {
  /**
   * Whether the new navigation shell is on. Before hydration completes this is the deployment
   * default (`NEXT_PUBLIC_FACET_NAV`); check `resolved` before unmounting anything on it.
   */
  enabled: boolean;
  /** False on the server and during hydration, when only CSS knows the answer. */
  resolved: boolean;
  /** Persist the per-user preview toggle (Settings → Appearance & accessibility). */
  setEnabled: (enabled: boolean) => void;
}

/** The `facet-nav` flag. */
export function useFacetNav(): FacetNavState {
  const value = useSyncExternalStore<boolean | null>(subscribe, readFacetNav, unknownOnServer);
  const setEnabled = useCallback((enabled: boolean) => {
    persist(NAV_STORAGE_KEYS.facetNav, enabled);
    writeAttributes({ facetNav: enabled });
  }, []);
  return { enabled: value ?? FACET_NAV_DEFAULT, resolved: value !== null, setEnabled };
}

export interface SidebarCollapsedState {
  /** `null` until hydrated; CSS (`sidebar-collapsed:` variant) handles the first paint. */
  collapsed: boolean | null;
  setCollapsed: (collapsed: boolean) => void;
}

/** The AppSidebar's persisted collapsed-to-icons state. */
export function useSidebarCollapsed(): SidebarCollapsedState {
  const collapsed = useSyncExternalStore<boolean | null>(subscribe, readCollapsed, unknownOnServer);
  const setCollapsed = useCallback((next: boolean) => {
    persist(NAV_STORAGE_KEYS.sidebarCollapsed, next);
    writeAttributes({ sidebarCollapsed: next });
  }, []);
  return { collapsed, setCollapsed };
}
