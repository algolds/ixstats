"use client";

import type { CSSProperties } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { cn } from "~/lib/utils/cn";

/**
 * One plane of a Lens backdrop's monogram (`facet-monogram`): it drifts against the pointer
 * (`usePointerParallax`'s `px`/`py`) by `depth` px at the box's edge, so planes at different depths
 * separate as the mouse moves and the glass above has moving grain to bend. `style` carries the
 * tile (`--monogram` or a `maskImage`); `className` sizes it past the box so a drift never shows an
 * edge.
 */
export function MonogramLayer({
  app,
  depth,
  style,
  px,
  py,
  className,
}: {
  app?: string;
  depth: number;
  style: CSSProperties;
  px: MotionValue<number>;
  py: MotionValue<number>;
  className?: string;
}) {
  const x = useTransform(px, (v) => v * -depth);
  const y = useTransform(py, (v) => v * -depth);
  return (
    <motion.div
      data-app={app}
      className={cn("facet-monogram absolute", className)}
      style={{ ...style, x, y }}
    />
  );
}
