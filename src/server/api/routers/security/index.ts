/**
 * Security router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.security.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - assessment: security assessment + threat catalog (threats, intelligence, incidents)
 *  - military:   military force structure (branches, units, assets)
 *  - defense:    defense budget, overview, and intelligence metrics
 *  - stability:  internal stability and security events
 *  - borders:    border security and neighbor threats
 *  - operations: active operations and PvP/PvNPC conflicts
 */
import { mergeRouters } from "~/server/api/trpc";
import { securityAssessmentRouter } from "./assessment";
import { securityMilitaryRouter } from "./military";
import { securityDefenseRouter } from "./defense";
import { securityStabilityRouter } from "./stability";
import { securityBordersRouter } from "./borders";
import { securityOperationsRouter } from "./operations";

export const securityRouter = mergeRouters(
  securityAssessmentRouter,
  securityMilitaryRouter,
  securityDefenseRouter,
  securityStabilityRouter,
  securityBordersRouter,
  securityOperationsRouter,
);
