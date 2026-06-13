/**
 * Diplomatic embassies router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API exposed by
 * `diplomaticEmbassiesRouter` is byte-identical to the former monolith — no call sites change,
 * and root.ts still imports `./routers/diplomacy/embassies` (now resolved to this index.ts).
 *
 * Domains:
 *  - queries:   read-only embassy lookups, cost/upgrade calculators
 *  - establish: embassy establishment and upgrades
 *  - lifecycle: embassy close / reopen / delete
 *  - missions:  embassy mission availability, start, complete, active listing
 *  - budget:    maintenance payment, budget allocation, profile updates
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticEmbassiesQueriesRouter } from "./queries";
import { diplomaticEmbassiesEstablishRouter } from "./establish";
import { diplomaticEmbassiesLifecycleRouter } from "./lifecycle";
import { diplomaticEmbassiesMissionsRouter } from "./missions";
import { diplomaticEmbassiesBudgetRouter } from "./budget";

export const diplomaticEmbassiesRouter = mergeRouters(
  diplomaticEmbassiesQueriesRouter,
  diplomaticEmbassiesEstablishRouter,
  diplomaticEmbassiesLifecycleRouter,
  diplomaticEmbassiesMissionsRouter,
  diplomaticEmbassiesBudgetRouter
);
