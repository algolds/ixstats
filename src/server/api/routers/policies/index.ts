/**
 * Policies router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.policies.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - crud:        policy CRUD + lifecycle (create/read/update/delete/activate/suspend/repeal)
 *  - effects:     policy effect logging + effectiveness analytics
 *  - schedules:   activity schedule CRUD (meetings/reviews tied to policies)
 *  - templates:   quick action template CRUD
 *  - integration: policy-builder selections, real-time effect calculation, component filtering
 */
import { mergeRouters } from "~/server/api/trpc";
import { policiesCrudRouter } from "./crud";
import { policiesEffectsRouter } from "./effects";
import { policiesSchedulesRouter } from "./schedules";
import { policiesTemplatesRouter } from "./templates";
import { policiesIntegrationRouter } from "./integration";

export const policiesRouter = mergeRouters(
  policiesCrudRouter,
  policiesEffectsRouter,
  policiesSchedulesRouter,
  policiesTemplatesRouter,
  policiesIntegrationRouter
);
