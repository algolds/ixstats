/**
 * Exchange phase 2 procedures: the share market and dividends, sector indices and funds,
 * company decisions and government tenders. Spec: docs/specs/2026-10-06-exchange-economy-design.md §8.
 * Every mutation is rate limited per procedure, acts as the signed-in user and checks the
 * Exchange flag inside its transaction; money-moving ones take a client `requestId`.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { SECTOR_KEYS } from "~/lib/exchange/companies";
import { createGovernmentContract } from "~/lib/exchange/contracts";
import {
  DECISION_TYPES,
  EXPAND_MAX,
  EXPAND_MIN,
  listDecisions,
  submitDecision,
} from "~/lib/exchange/decisions";
import { declareDividend, listDividends } from "~/lib/exchange/dividends";
import { listShareMarket } from "~/lib/exchange/queries";
import { buySectorUnits, getSectorMarket, sellSectorUnits } from "~/lib/exchange/sectors";
import {
  MAX_SHARES_ISSUED,
  buyShares,
  cancelListing,
  issueShares,
  listShares,
  setShareTrading,
} from "~/lib/exchange/shares";
import { guard } from "./_errors";

const requestId = z.string().min(8).max(64);
const id = z.string().min(1);
const shares = z.number().int().min(1).max(MAX_SHARES_ISSUED);

export const exchangeMarketsRouter = createTRPCRouter({
  /** Open share listings, cheapest first. */
  getShareMarket: protectedProcedure.query(({ ctx }) =>
    guard("load the share market", () => listShareMarket(ctx.db, ctx.user.id))
  ),

  setShareTrading: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, open: z.boolean() }))
    .mutation(({ ctx, input }) =>
      guard("change share trading", () =>
        setShareTrading(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),

  issueShares: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, shares, requestId }))
    .mutation(({ ctx, input }) =>
      guard("issue shares", () => issueShares(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  listShares: rateLimitedMutationProcedure
    .input(
      z.object({
        companyId: id,
        shares,
        pricePerShare: z.number().min(0.01).max(1_000_000).multipleOf(0.01),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("list shares", () => listShares(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  cancelShareListing: rateLimitedMutationProcedure
    .input(z.object({ listingId: id }))
    .mutation(({ ctx, input }) =>
      guard("cancel the listing", () =>
        cancelListing(ctx.db, { userId: ctx.user.id, listingId: input.listingId })
      )
    ),

  buyShares: rateLimitedMutationProcedure
    .input(z.object({ listingId: id, shares, requestId }))
    .mutation(({ ctx, input }) =>
      guard("buy shares", () => buyShares(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  declareDividend: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, amount: z.number().int().min(1).max(10_000_000), requestId }))
    .mutation(({ ctx, input }) =>
      guard("pay the dividend", () => declareDividend(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  /** A company's dividends and decisions (public record). */
  getCompanyRecord: protectedProcedure.input(z.object({ companyId: id })).query(({ ctx, input }) =>
    guard("load the company record", async () => {
      const [dividends, decisions] = await Promise.all([
        listDividends(ctx.db, input.companyId),
        listDecisions(ctx.db, input.companyId),
      ]);
      return { dividends, decisions };
    })
  ),

  submitDecision: rateLimitedMutationProcedure
    .input(
      z.object({
        companyId: id,
        type: z.enum(DECISION_TYPES),
        amount: z.number().int().min(EXPAND_MIN).max(EXPAND_MAX).optional(),
        sectorKey: z.enum(SECTOR_KEYS).optional(),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("queue the decision", () => submitDecision(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  /** Sector indices with history, fund unit prices and my positions. */
  getSectors: protectedProcedure.query(({ ctx }) =>
    guard("load the sectors", () => getSectorMarket(ctx.db, ctx.user.id))
  ),

  buySectorUnits: rateLimitedMutationProcedure
    .input(
      z.object({
        sectorKey: z.enum(SECTOR_KEYS),
        amount: z.number().int().min(1).max(1_000_000),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("buy fund units", () => buySectorUnits(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  sellSectorUnits: rateLimitedMutationProcedure
    .input(
      z.object({
        sectorKey: z.enum(SECTOR_KEYS),
        fraction: z.number().gt(0).max(1),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("sell fund units", () => sellSectorUnits(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  /** Post a government tender for a nation you own, funded from your wallet. */
  createTender: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: id,
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).optional(),
        sectorKey: z.enum(SECTOR_KEYS),
        value: z.number().int().min(10).max(10_000_000),
        biddingDays: z.number().int().min(1).max(30),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("post the tender", () =>
        createGovernmentContract(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),
});
