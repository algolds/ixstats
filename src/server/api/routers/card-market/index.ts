/**
 * Card Market router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.cardMarket.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - auctionManagement: auction create/cancel/buyout + demo seeding (mutations)
 *  - auctionQueries:    active/by-id/history/featured/my-auctions reads
 *  - bids:              place bid, bid history, my active bids, my participation
 *  - analytics:         a card's value history
 *  - wishlist:          the player's wishlist
 */
import { mergeRouters } from "~/server/api/trpc";
import { cardMarketAuctionManagementRouter } from "./auctionManagement";
import { cardMarketAuctionQueriesRouter } from "./auctionQueries";
import { cardMarketBidsRouter } from "./bids";
import { cardMarketAnalyticsRouter } from "./analytics";
import { cardMarketWishlistRouter } from "./wishlist";

export const cardMarketRouter = mergeRouters(
  cardMarketAuctionManagementRouter,
  cardMarketAuctionQueriesRouter,
  cardMarketBidsRouter,
  cardMarketAnalyticsRouter,
  cardMarketWishlistRouter
);
