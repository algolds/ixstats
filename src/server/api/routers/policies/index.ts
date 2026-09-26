/**
 * Policies router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.policies.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - crud:      policy CRUD + lifecycle (create/read/update/delete/activate/suspend/repeal)
 *  - templates: quick action template CRUD
 */
import { mergeRouters } from "~/server/api/trpc";
import { policiesCrudRouter } from "./crud";
import { policiesTemplatesRouter } from "./templates";

export const policiesRouter = mergeRouters(policiesCrudRouter, policiesTemplatesRouter);
