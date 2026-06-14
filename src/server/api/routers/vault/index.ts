/**
 * Vault router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.vault.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - balance-credits: user wallet — balance, budget multiplier, earn/spend, level, earnings
 *  - daily-claims:    daily bonus / streak / combined claim + admin streak adjustment
 *  - store:           storefront — list, config, purchase, purchased items, transactions
 *  - collections:     card collection CRUD, public browse, comments, leaderboard, likes
 *  - admin:           credit adjustments, store-item CRUD, vault config, season, purchase logs
 */
import { mergeRouters } from "~/server/api/trpc";
import { vaultBalanceCreditsRouter } from "./balance-credits";
import { vaultDailyClaimsRouter } from "./daily-claims";
import { vaultStoreRouter } from "./store";
import { vaultCollectionsRouter } from "./collections";
import { vaultAdminRouter } from "./admin";

export const vaultRouter = mergeRouters(
  vaultBalanceCreditsRouter,
  vaultDailyClaimsRouter,
  vaultStoreRouter,
  vaultCollectionsRouter,
  vaultAdminRouter
);
