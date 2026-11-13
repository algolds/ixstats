"use client";

import type { CSSProperties } from "react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { Card, useInsideCard, useInsideOverlay, type CardProps } from "~/components/ui/card";
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

/**
 * Grid/flex placement, width and margin utilities belong on the outer `[data-slot="lens-card"]`
 * wrapper (the actual grid/flex child and the bounds of the `absolute inset-0` monogram stage),
 * while interior layout utilities (`space-y-*`, `flex`, `grid`, `overflow-*`, `h-*`) stay on `Card`.
 */
const OUTER_CLASS_TOKEN =
  /^(?:[a-z0-9-]+:)*(?:-?(?:col|row)-(?:span|start|end)-\S+|max-w-\S+|min-w-\S+|w-\S+|self-\S+|justify-self-\S+|place-self-\S+|order-\S+|flex-1|flex-auto|flex-initial|flex-none|grow(?:-\S+)?|shrink(?:-\S+)?|-?m[xytrblse]?-\S+)$/;

function splitLensClasses(className?: string): { outer: string; inner: string } {
  if (!className) return { outer: "", inner: "" };
  const outer: string[] = [];
  const inner: string[] = [];
  for (const token of className.trim().split(/\s+/)) {
    if (!token) continue;
    if (OUTER_CLASS_TOKEN.test(token)) {
      outer.push(token);
    } else {
      inner.push(token);
    }
  }
  return { outer: outer.join(" "), inner: inner.join(" ") };
}

interface LensCardProps extends Omit<CardProps, "variant"> {
  /** The app whose tint washes the glass and colours the card's accents; without it, the page's. */
  app?: (typeof APP_IDS)[number];
  /**
   * Whether the monogram planes drift with mouse movement. Set to `false` when the card enters an
   * active reading/composing state (e.g. an open conversation thread) so the backdrop stays still.
   * Defaults to `true`.
   */
  interactiveMonogram?: boolean;
}

/**
 * Facet's standard Lens card: a drop-in `Card` on Lens glass, over its app's tint and a shared
 * page-wide monogram grain (`fixed -inset-6` clipped to each card's rounded bounds) that drifts
 * with the mouse in two planes across all containers at once, so the refraction moves seamlessly
 * while the card and its text stay still (owner ruling 2026-11-11: cards never move). Inside an
 * overlay or another card it falls back to a standard `Card`, as glass never sits on glass. Reduce
 * Motion or `interactiveMonogram={false}` stills the grain; Reduce Transparency and Increase
 * Contrast make the glass solid and drop the wash and grain.
 */
export function LensCard({
  app,
  interactiveMonogram = true,
  className,
  children,
  ...cardProps
}: LensCardProps) {
  const inOverlay = useInsideOverlay();
  const inCard = useInsideCard();
  const reduceMotion = useFacetReducedMotion();
  const staticMonogram = reduceMotion || !interactiveMonogram;
  const parallax = usePointerParallax(staticMonogram);

  if (inOverlay || inCard) {
    return (
      <Card {...cardProps} className={className}>
        {children}
      </Card>
    );
  }

  const { outer, inner } = splitLensClasses(className);

  return (
    <div
      data-app={app}
      data-slot="lens-card"
      data-monogram-interactive={staticMonogram ? "false" : "true"}
      className={cn("relative min-w-0", outer)}
    >
      <div
        aria-hidden
        data-slot="lens-monogram-stage"
        className={cn(
          "rounded-card pointer-events-none absolute inset-0 overflow-hidden [clip-path:inset(0_round_var(--radius-card))] print:hidden",
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
            className="fixed -inset-6"
          />
        ))}
      </div>
      <Card {...cardProps} className={inner || undefined} variant="lens">
        {children}
      </Card>
    </div>
  );
}
