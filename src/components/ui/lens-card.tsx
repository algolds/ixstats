"use client";

import type { CSSProperties } from "react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { Card, useInsideOverlay, type CardProps } from "~/components/ui/card";
import { MonogramLayer } from "~/components/ui/facet/shared/MonogramLayer";
import { usePointerParallax } from "~/hooks/usePointerParallax";
import { withBasePath } from "~/lib/base-path";
import type { APP_IDS } from "~/lib/design/tokens";
import { cn } from "~/lib/utils/cn";

const tile = (apps: readonly string[]): CSSProperties =>
  ({
    "--monogram-strength": "6%",
    maskImage: apps
      .map((app) => `url("${withBasePath(`/images/ix-monogram-${app}.svg`)}")`)
      .join(", "),
    maskSize: "210px 105px",
    maskRepeat: "repeat",
  }) as CSSProperties;

/** Two depth planes, as the hero's: the W marks sit shallower than the emblems, so they separate as the mouse moves. */
const PLANES = [
  { key: "marks", depth: 4, style: tile(["wiki"]) },
  { key: "emblems", depth: 8, style: tile(["mycountry", "maps", "realms"]) },
] as const;

const WASH =
  "bg-[color-mix(in_srgb,var(--tint)_var(--tint-wash),transparent)] transparency-reduced:bg-transparent contrast-more:bg-transparent";

interface LensCardProps extends Omit<CardProps, "variant"> {
  /** The app whose tint washes the glass and colours the card's accents; without it, the page's. */
  app?: (typeof APP_IDS)[number];
}

/**
 * Facet's standard Lens card: a drop-in `Card` on Lens glass, over its app's tint and a monogram
 * grain that drifts with the mouse in two planes, so the refraction moves while the card and its text
 * stay still (owner ruling 2026-11-11: cards never move). Inside an overlay it is a plain pane, as a
 * Lens never sits on an Overlay. Reduce Motion stills the grain; Reduce Transparency and Increase
 * Contrast make the glass solid and drop the wash and grain.
 */
export function LensCard({ app, children, ...cardProps }: LensCardProps) {
  const inOverlay = useInsideOverlay();
  const reduceMotion = useFacetReducedMotion();
  const parallax = usePointerParallax(reduceMotion);

  if (inOverlay) return <Card {...cardProps}>{children}</Card>;

  return (
    <div
      data-app={app}
      data-slot="lens-card"
      className="relative"
      onPointerMove={parallax.onPointerMove}
      onPointerLeave={parallax.onPointerLeave}
    >
      <div
        aria-hidden
        className={cn(
          "rounded-card pointer-events-none absolute inset-0 overflow-hidden print:hidden",
          WASH
        )}
      >
        {PLANES.map((plane) => (
          <MonogramLayer
            key={plane.key}
            depth={plane.depth}
            style={plane.style}
            px={parallax.px}
            py={parallax.py}
            className="-inset-3"
          />
        ))}
      </div>
      <Card {...cardProps} variant="lens">
        {children}
      </Card>
    </div>
  );
}
