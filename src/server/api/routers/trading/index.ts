/**
 * Trading router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.trading.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - offers:  P2P trade offer lifecycle (create, accept/reject/counter, cancel)
 *  - queries: read-only trade queries (active list, history, detail by id)
 *  - builder: partner lookup by handle and search, tradeable copies, the partner's wishlist
 */
import { mergeRouters } from "~/server/api/trpc";
import { tradingBuilderRouter } from "./builder";
import { tradingOffersRouter } from "./offers";
import { tradingQueriesRouter } from "./queries";

export const tradingRouter = mergeRouters(
  tradingOffersRouter,
  tradingQueriesRouter,
  tradingBuilderRouter
);
