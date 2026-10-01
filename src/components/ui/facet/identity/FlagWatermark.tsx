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
 * Facet hero identity (reference §3): decorative marks behind a hero card's content — a corner
 * flag watermark, a tint hairline and a glyph watermark. Never a full-width image wash.
 */

/**
 * The country's flag as a circular watermark bleeding off a card's top-right corner — the
 * MyCountry identity mark from the pre-Facet overview (c5c6b382 `StandingBands`), rebuilt on
 * tokens: one low opacity for both themes (no `dark:` pair), `mix-blend-luminosity` so it reads
 * as a muted monochrome imprint of the card behind it, and a CSS mask for the fade (no gradient
 * class). Decorative only: aria-hidden, not printed, no pointer events. Render it as the first
 * child of a `relative overflow-hidden` card and keep the card's content `relative`.
 */
export function FlagWatermark({ src, className }: FlagWatermarkProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div
      aria-hidden="true"
      data-slot="flag-watermark"
      className={cn(
        "pointer-events-none absolute -top-10 -right-10 size-56 overflow-hidden rounded-full select-none print:hidden",
        className
      )}
    >
      {/* The blend, opacity and mask sit on the image itself so it blends with the card, not an
          isolated group. */}
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

/**
 * A large fine-stroke glyph watermark in a card's bottom-right corner (the pre-Facet priority
 * card and domain hero, c5c6b382). `text-label` at a very low opacity keeps it theme-safe.
 */
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
