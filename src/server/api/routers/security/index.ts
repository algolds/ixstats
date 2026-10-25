/**
 * Security router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.security.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - assessment: security assessment, derived on read (~/lib/military/threat-picture)
 *  - military:   order of battle read and military assets
 *  - force-structure: branch and unit authoring, starter force (MC-3)
 *  - stability:  internal stability (owner-only metrics)
 *  - borders:    border security and neighbor threats, derived on read
 *  - operations: active operations and PvP/PvNPC conflicts
 */
import { mergeRouters } from "~/server/api/trpc";
import { securityAssessmentRouter } from "./assessment";
import { securityMilitaryRouter } from "./military";
import { securityForceStructureRouter } from "./force-structure";
import { securityStabilityRouter } from "./stability";
import { securityBordersRouter } from "./borders";
import { securityOperationsRouter } from "./operations";
import { securityConflictsRouter } from "./conflicts";

export const securityRouter = mergeRouters(
  securityAssessmentRouter,
  securityMilitaryRouter,
  securityForceStructureRouter,
  securityStabilityRouter,
  securityBordersRouter,
  securityOperationsRouter,
  securityConflictsRouter
);
