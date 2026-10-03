"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "~/lib/utils/cn";

/** Fades the circle out toward the card's content (left), so it never competes with the text. */
const FADE_LEFT: CSSProperties = {
  maskImage: "linear-gradient(to left, black 30%, transparent 92%)",
  WebkitMaskImage: "linear-gradient(to left, black 30%, transparent 92%)",
};

interface FlagWatermarkProps {
  /** Flag image; nothing renders without one (or when it fails to load). */
  src: string | null | undefined;
  className?: string;
}

/**
 * The country's flag as a circular watermark bleeding off a card's top-right corner. Decorative:
 * aria-hidden, not printed, no pointer events. Render it as the first child of a `relative
 * overflow-hidden` card; size it down with `className` on compact cards.
 */
export function FlagWatermark({ src, className }: FlagWatermarkProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div
      aria-hidden="true"
      data-slot="flag-watermark"
      data-interactive="true"
      className={cn(
        "facet-flag-watermark pointer-events-none absolute -top-12 -right-12 size-80 overflow-hidden rounded-full select-none print:hidden",
        className
      )}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={FADE_LEFT}
        className="size-full rounded-full object-cover object-center"
      />
    </div>
  );
}
