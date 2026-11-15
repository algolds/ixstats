"use client";

import type { CSSProperties } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { MonogramLayer } from "~/components/ui/facet/shared/MonogramLayer";
import { usePointerParallax } from "~/hooks/usePointerParallax";
import { withBasePath } from "~/lib/base-path";
import { guillochePlanePaths } from "~/lib/passport/guilloche";
import { cn } from "~/lib/utils";

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 630;
const PLANES = guillochePlanePaths(VIEW_WIDTH, VIEW_HEIGHT);

const PASSPORT_MONOGRAM = {
  "--monogram-strength": "6%",
  maskImage: `url("${withBasePath("/images/ix-monogram-wiki.svg")}")`,
  maskSize: "210px 105px",
  maskRepeat: "repeat",
} as CSSProperties;

const WASH =
  "bg-[color-mix(in_srgb,var(--tint)_var(--tint-wash),transparent)] transparency-reduced:bg-transparent contrast-more:bg-transparent";

function GuillochePlane({
  paths,
  depth,
  px,
  py,
  opacityClass,
}: {
  paths: readonly string[];
  depth: number;
  px: MotionValue<number>;
  py: MotionValue<number>;
  opacityClass: string;
}) {
  const x = useTransform(px, (v) => v * -depth);
  const y = useTransform(py, (v) => v * -depth);

  return (
    <motion.svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.9}
      style={{ x, y }}
      className={cn(
        "text-tint transparency-reduced:hidden pointer-events-none absolute -inset-5 h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)] select-none contrast-more:hidden",
        opacityClass
      )}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </motion.svg>
  );
}

/**
 * Facet Lens monogram & security-print backdrop for the Passport front face: a subtle tint wash,
 * the Ixnay monogram lattice, and two depth planes of interwoven guilloché rosettes that drift
 * against the pointer so the Lens glass above refracts them. Stilled under Reduce Motion; dropped
 * under Reduce Transparency and Increase Contrast.
 */
export function PassportGuilloche({ className }: { className?: string }) {
  const reduceMotion = useFacetReducedMotion();
  const { px, py } = usePointerParallax(reduceMotion);

  return (
    <div
      aria-hidden="true"
      data-slot="passport-lens-stage"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden print:hidden",
        WASH,
        className
      )}
    >
      <MonogramLayer depth={4} style={PASSPORT_MONOGRAM} px={px} py={py} className="-inset-5" />
      <GuillochePlane paths={PLANES.far} depth={7} px={px} py={py} opacityClass="opacity-12" />
      <GuillochePlane paths={PLANES.near} depth={12} px={px} py={py} opacityClass="opacity-16" />
    </div>
  );
}
