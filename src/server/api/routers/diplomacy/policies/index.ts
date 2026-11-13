/**
 * Diplomatic Policies router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.diplomaticPolicies.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - foreignPolicy: embargo / sanction / free_trade / military_alliance / blockade actions
 *    (Phase 2 Foreign Policy Actions) and bilateral trade data.
 *  - alliances:     Alliance / Bloc system (Phase 3) — membership, voting, documents.
 *  - summits:       leaders' summits, proposed and agreed through the same inbox as treaties.
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticPoliciesForeignPolicyRouter } from "./foreignPolicy";
import { diplomaticPoliciesAlliancesRouter } from "./alliances";
import { diplomaticPoliciesSummitsRouter } from "./summits";

export const diplomaticPoliciesRouter = mergeRouters(
  diplomaticPoliciesForeignPolicyRouter,
  diplomaticPoliciesAlliancesRouter,
  diplomaticPoliciesSummitsRouter
);
