"use client";
// src/components/wiki-os/reader/useScrollSpy.ts
// Which section the reader is in, without touching layout while they scroll.

import { useEffect } from "react";

/** A heading counts as passed once its top is at or above this line below the viewport's top. */
const ACTIVE_LINE_PX = 120;

/**
 * Calls `onChange` with the id of the last heading (in `ids`' order) whose top is at or above the
 * active line, or null above the first; only when that changes. The headings' document offsets are
 * measured when the hook starts and whenever the page's size changes (images and fonts arriving),
 * never per scroll event: a scroll costs one comparison pass over cached numbers, at most once a frame.
 */
export function useScrollSpy(ids: readonly string[], onChange: (id: string | null) => void): void {
  useEffect(() => {
    if (ids.length === 0) return;

    let offsets: Array<{ id: string; top: number }> = [];
    let frame = 0;
    let last: string | null | undefined;

    const measure = () => {
      offsets = [];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element)
          offsets.push({ id, top: element.getBoundingClientRect().top + window.scrollY });
      }
    };

    const update = () => {
      frame = 0;
      const line = window.scrollY + ACTIVE_LINE_PX;
      let current: string | null = null;
      for (const { id, top } of offsets) if (top <= line) current = id;
      if (current !== last) {
        last = current;
        onChange(current);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const remeasure = () => {
      measure();
      schedule();
    };

    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    const resized = new ResizeObserver(remeasure);
    resized.observe(document.documentElement);

    return () => {
      window.removeEventListener("scroll", schedule);
      resized.disconnect();
      if (frame) cancelAnimationFrame(frame);
      onChange(null);
    };
  }, [ids, onChange]);
}
