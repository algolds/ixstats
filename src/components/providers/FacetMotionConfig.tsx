"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

/**
 * Reduced-motion switch for every `motion` element.
 *
 * `MotionConfig reducedMotion="user"` only follows the OS. The in-app Reduce Motion setting is
 * written to `html[data-motion="reduced"]` (pre-paint script + ThemeProvider), so this reads that
 * attribute and forces `"always"` while it is set.
 */

function subscribeToMotionAttribute(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  return () => observer.disconnect();
}

function readMotionAttribute(): boolean {
  return document.documentElement.getAttribute("data-motion") === "reduced";
}

/** True while the in-app Reduce Motion setting is on (`html[data-motion="reduced"]`). */
export function useInAppReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToMotionAttribute, readMotionAttribute, () => false);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionQuery(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

function readMotionQuery(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** True when either the OS or the in-app setting asks for reduced motion. */
export function useFacetReducedMotion(): boolean {
  const os = useSyncExternalStore(subscribeToMotionQuery, readMotionQuery, () => false);
  return useInAppReducedMotion() || os;
}

export function FacetMotionConfig({ children }: { children: ReactNode }) {
  const inApp = useInAppReducedMotion();
  return <MotionConfig reducedMotion={inApp ? "always" : "user"}>{children}</MotionConfig>;
}
