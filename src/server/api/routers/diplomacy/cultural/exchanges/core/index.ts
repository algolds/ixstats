/**
 * Diplomatic cultural exchanges CORE sub-router — split across files by concern
 * (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * (`api.diplomaticCulturalExchanges.*` — when accessed via the parent's
 * `mergeRouters(diplomaticCulturalExchangesCoreRouter, …)`) is byte-identical to the
 * former monolith — no call sites change.
 *
 * Concerns:
 *  - queries:   read paths (getCulturalExchanges)
 *  - mutations: write paths (createCulturalExchange, joinCulturalExchange)
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalExchangesCoreQueriesRouter } from "./queries";
import { diplomaticCulturalExchangesCoreMutationsRouter } from "./mutations";

export const diplomaticCulturalExchangesCoreRouter = mergeRouters(
  diplomaticCulturalExchangesCoreQueriesRouter,
  diplomaticCulturalExchangesCoreMutationsRouter
);
