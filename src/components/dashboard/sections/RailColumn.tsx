"use client";

import { Children, isValidElement, useEffect, useRef, type ReactNode } from "react";

/**
 * The dashboard rail without a scrollbar: cards show in priority order while they fit the viewport
 * height. A card that does not fit wraps into a second, clipped column (CSS does the layout) and is
 * made inert, so keyboard focus never lands on a card nobody can see. Below xl the rail is a sheet and
 * scrolls as usual.
 */
export function RailColumn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).inert = entry.intersectionRatio < 0.99;
        }
      },
      { root, threshold: [0, 0.99] }
    );
    for (const card of root.children) io.observe(card);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex flex-col gap-4 *:empty:hidden xl:h-full xl:flex-wrap xl:content-start xl:overflow-clip xl:*:w-full"
    >
      {Children.toArray(children).map((child) => (
        <div key={isValidElement(child) ? child.key : String(child)}>{child}</div>
      ))}
    </div>
  );
}
