"use client";

import dynamic from "next/dynamic";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import type { CosmeticParticlesProps } from "./CosmeticParticlesCanvas";

export type { CosmeticParticlesProps };

const LazyCosmeticParticlesCanvas = dynamic<CosmeticParticlesProps>(
  () => import("./CosmeticParticlesCanvas").then((mod) => mod.CosmeticParticlesCanvas),
  { ssr: false }
);

export function CosmeticParticles(props: CosmeticParticlesProps) {
  const reduceMotion = useFacetReducedMotion();
  if (reduceMotion || !props.style) return null;
  return <LazyCosmeticParticlesCanvas {...props} />;
}
