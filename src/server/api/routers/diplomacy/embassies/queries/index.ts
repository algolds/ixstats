/**
 * Diplomatic embassies queries router — split across files by concern (2026-06-13) and
 * recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API exposed by
 * `diplomaticEmbassiesQueriesRouter` is byte-identical to the former monolith — no call
 * sites change, and diplomacy/embassies/index.ts still imports `./queries` (now resolved
 * to this index.ts).
 *
 * Concerns:
 *  - embassyListings:   read-only embassy lookups (network listing, single-embassy details)
 *
 * There is no embassy economy: opening one costs nothing, so no establishment-cost estimate is served.
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticEmbassiesQueriesEmbassyListingsRouter } from "./embassyListings";

export const diplomaticEmbassiesQueriesRouter = mergeRouters(
  diplomaticEmbassiesQueriesEmbassyListingsRouter
);
