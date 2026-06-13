/**
 * Card Market router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.cardMarket.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - auctionManagement: auction create/cancel/buyout + demo seeding (mutations)
 *  - auctionQueries:    active/by-id/history/featured/ending-soon/my-auctions reads
 *  - bids:              place bid, bid history, my active bids, my participation
 *  - watchlist:         add/remove/get card watchlist
 *  - analytics:         market trends, value/transfer history, dust, inscribe
 */
import { mergeRouters } from "~/server/api/trpc";
import { cardMarketAuctionManagementRouter } from "./auctionManagement";
import { cardMarketAuctionQueriesRouter } from "./auctionQueries";
import { cardMarketBidsRouter } from "./bids";
import { cardMarketWatchlistRouter } from "./watchlist";
import { cardMarketAnalyticsRouter } from "./analytics";

export const cardMarketRouter = mergeRouters(
  cardMarketAuctionManagementRouter,
  cardMarketAuctionQueriesRouter,
  cardMarketBidsRouter,
  cardMarketWatchlistRouter,
  cardMarketAnalyticsRouter
);
