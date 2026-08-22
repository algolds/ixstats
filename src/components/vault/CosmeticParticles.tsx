"use client";

import dynamic from "next/dynamic";
import type { CosmeticParticlesProps } from "./CosmeticParticlesCanvas";

export type { CosmeticParticlesProps };

export const CosmeticParticles = dynamic<CosmeticParticlesProps>(
  () => import("./CosmeticParticlesCanvas").then((mod) => mod.CosmeticParticlesCanvas),
  { ssr: false }
);
