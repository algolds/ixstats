/**
 * Cultural compatibility router — split across files by domain (2026-06-13) and
 * recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * (`api.<...>.diplomaticCultural.*`) is byte-identical to the former monolith — no
 * call sites change.
 *
 * Domains:
 *  - impact: Markov-engine cultural exchange impact calculation + outcome persistence
 *  - scores: cultural compatibility scoring and recommended diplomatic partners
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalCompatibilityImpactRouter } from "./impact";
import { diplomaticCulturalCompatibilityScoresRouter } from "./scores";

export const diplomaticCulturalCompatibilityRouter = mergeRouters(
  diplomaticCulturalCompatibilityImpactRouter,
  diplomaticCulturalCompatibilityScoresRouter
);
