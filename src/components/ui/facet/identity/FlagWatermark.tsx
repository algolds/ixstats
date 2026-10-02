"use client";

import { useState, type ComponentType, type CSSProperties } from "react";
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

/** A hairline of the app tint along a hero card's top edge (decorative). */
export function TintHairline({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-8 top-0 h-px opacity-70 print:hidden",
        className
      )}
      style={{
        backgroundImage: "linear-gradient(to right, transparent, var(--tint), transparent)",
      }}
    />
  );
}

/** A large fine-stroke glyph watermark in a card's bottom-right corner. */
export function WatermarkGlyph({
  icon: Icon,
  className,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  className?: string;
}) {
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1}
      className={cn(
        "text-label pointer-events-none absolute -right-6 -bottom-6 size-40 opacity-[0.04] select-none print:hidden",
        className
      )}
    />
  );
}
