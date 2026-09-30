"use client";

import { useEffect, useState } from "react";

/**
 * useScrollSpy — the id of the section currently under the reading line (the upper third of
 * the viewport), for `aria-current` on a chapter index or dock. Sections that are not mounted
 * are ignored, so omitted chapters never become active.
 */
export function useScrollSpy(
  ids: readonly string[],
  rootMargin = "-20% 0px -65% 0px"
): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // The first visible section in document order wins.
        const first = elements.find((el) => visible.has(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [key, rootMargin]);

  return active;
}
