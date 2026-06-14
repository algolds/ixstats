/**
 * Trading router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.trading.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - offers:  P2P trade offer lifecycle (create, accept/reject/counter, cancel)
 *  - queries: read-only trade queries (active list, history, detail by id)
 *  - social:  card gifting and partner search (gifting + discovery)
 */
import { mergeRouters } from "~/server/api/trpc";
import { tradingOffersRouter } from "./offers";
import { tradingQueriesRouter } from "./queries";
import { tradingSocialRouter } from "./social";

export const tradingRouter = mergeRouters(
  tradingOffersRouter,
  tradingQueriesRouter,
  tradingSocialRouter
);
