"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "~/lib/utils/cn";

/** Fades the disc toward the card's content (left), so it never competes with the text. */
const FADE_LEFT: CSSProperties = {
  maskImage: "linear-gradient(to left, black 30%, transparent 92%)",
  WebkitMaskImage: "linear-gradient(to left, black 30%, transparent 92%)",
};

/**
 * CornerFlag — the country's flag as a circular watermark bleeding off a hero card's top-right
 * corner (the StandingBands identity mark): low opacity in both themes, luminosity blend, masked
 * toward the content. Decorative: aria-hidden, not printed, no pointer events. Render it as the
 * first child of a `relative overflow-hidden` card and keep the content `relative`.
 */
export function CornerFlag({
  src,
  className,
}: {
  src: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -top-10 -right-10 size-56 overflow-hidden rounded-full select-none print:hidden",
        className
      )}
    >
      {/* oxlint-disable-next-line nextjs/no-img-element -- decorative remote flag, no layout */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={FADE_LEFT}
        className="size-full rounded-full object-cover object-center opacity-[0.14] mix-blend-luminosity blur-[1px]"
      />
    </div>
  );
}
