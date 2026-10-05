/**
 * Policies router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.policies.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - crud:      create, list, CivCap recon context
 *  - lifecycle: repeal (expiry runs in the policy-maintenance job, lib/policies/lifecycle.ts)
 *
 * Bills (policies voted into force) live in the legislation router.
 */
import { mergeRouters } from "~/server/api/trpc";
import { policiesCrudRouter } from "./crud";
import { policiesLifecycleRouter } from "./lifecycle";

export const policiesRouter = mergeRouters(policiesCrudRouter, policiesLifecycleRouter);
