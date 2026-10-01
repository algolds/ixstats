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
  /**
   * Brighten (.14/.18 → .25) and scale to 105% while the hero is hovered — the v2 DashboardHero
   * behaviour. The hover host is the nearest `group` element, `FacetCard` or `CutoutCard`.
   * Reduce Motion keeps the brighten and drops the scale. @default true
   */
  interactive?: boolean;
  className?: string;
}

/**
 * Facet hero identity (reference §3, Facet 3.1 §16): decorative marks behind a hero card's
 * content — a corner flag watermark, a tint hairline and a glyph watermark. Never a full-width
 * image wash.
 */

/**
 * The country's flag as a circular watermark bleeding off a card's top-right corner, at v2
 * strength (c5c6b382 DashboardHero: 320px, `-top-12 -right-12`, opacity .14 light / .18 dark,
 * `mix-blend-luminosity` in light, 1px blur, → .25 and `scale-105` over 700ms when the hero is
 * hovered). Tokens (`--flag-watermark-*`) replace the `dark:` pair; a CSS mask fades the disc
 * toward the content instead of v2's gradient overlay. HIG (spec §16.8): a tone filter
 * (`--flag-watermark-tone`: `contrast(.7)` light, `brightness(.6)` dark) caps the flag's extremes so
 * `label` and `label-secondary` stay ≥ 4.5:1 over any flag on a hero at rest and on hover; Increase
 * Contrast keeps it at rest (no brighten). Decorative only: aria-hidden, not printed,
 * no pointer events. Render it as the first child of a `relative overflow-hidden` card and keep
 * the card's content `relative`; size it down with `className` (e.g. `size-56 -top-10 -right-10`)
 * on compact cards.
 */
export function FlagWatermark({ src, interactive = true, className }: FlagWatermarkProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div
      aria-hidden="true"
      data-slot="flag-watermark"
      data-interactive={interactive}
      className={cn(
        "facet-flag-watermark pointer-events-none absolute -top-12 -right-12 size-80 overflow-hidden rounded-full select-none print:hidden",
        className
      )}
    >
      {/* The mask sits on the image; opacity, blend and blur on the wrapper (identity.css). */}
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
