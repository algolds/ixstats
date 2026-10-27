"use client";
// src/components/wiki-os/reader/useSisterHash.ts
// A link into a section of a sister reader page (`/wiki/X?source=iiwiki#History`) names the wiki's own id, and the
// page holds it prefixed (`sister-History`, sister-dom.ts), so the browser finds nothing to scroll to. On a sister
// page this lands the hash on the prefixed id instead: the location's hash is replaced (no new history entry) and the
// section scrolled into view, on arrival, when the article's HTML arrives, and on each later hash change.

import { useEffect, type RefObject } from "react";
import { sisterHashTarget } from "~/lib/wiki-os/sister-dom";

export function useSisterHash(
  contentRef: RefObject<HTMLElement | null>,
  active: boolean,
  html: string
): void {
  useEffect(() => {
    if (!active) return;
    const land = () => {
      const target = sisterHashTarget(window.location.hash);
      const element = target ? document.getElementById(target.id) : null;
      if (!target || !element || !contentRef.current?.contains(element)) return;
      window.history.replaceState(window.history.state, "", target.hash);
      element.scrollIntoView();
    };
    land();
    window.addEventListener("hashchange", land);
    return () => window.removeEventListener("hashchange", land);
  }, [contentRef, active, html]);
}
