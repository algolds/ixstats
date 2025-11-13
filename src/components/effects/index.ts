// src/components/effects/index.ts
// Barrel export for effect components

export { ParticleSystem } from "./ParticleSystem";
export type { ParticleSystemProps, ParticleConfig, ParticleType } from "./ParticleSystem";

export {
  PageTransition,
  SharedElementTransition,
  GlassMorphTransition,
} from "./PageTransitions";
export type {
  PageTransitionProps,
  SharedElementTransitionProps,
  TransitionVariant,
} from "./PageTransitions";
