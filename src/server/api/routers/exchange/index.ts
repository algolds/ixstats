/**
 * Exchange router: the Sovereign (₷) economy. Conversion, companies and contracts.
 * Spec: docs/specs/2026-10-06-exchange-economy-design.md; system doc: docs/systems/exchange.md.
 *
 * Every mutation is rate limited per procedure and checks the `vault_isExchangeEnabled`
 * flag (and vault maintenance mode) inside its transaction. Money-moving mutations take a
 * client-generated `requestId`, so a retried request is applied once.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  mergeRouters,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { convert } from "~/lib/exchange/conversion";
import {
  SECTOR_KEYS,
  depositToCompany,
  dissolveCompany,
  foundCompany,
  listCompanies,
  withdrawFromCompany,
} from "~/lib/exchange/companies";
import {
  awardContract,
  cancelContract,
  completeContract,
  createContract,
  disputeContract,
  placeBid,
  releaseContract,
  withdrawBid,
} from "~/lib/exchange/contracts";
import { getExchangeOverview, listContracts } from "~/lib/exchange/queries";
import { guard } from "./_errors";
import { exchangeAdminRouter } from "./admin";

const requestId = z.string().min(8).max(64);
const sovereigns = z.number().int().min(1).max(10_000_000);

const exchangeUserRouter = createTRPCRouter({
  /** Wallet, conversion terms and today's allowance, my companies, recent ledger rows. */
  getOverview: protectedProcedure.query(({ ctx }) =>
    guard("load the Exchange", () => getExchangeOverview(ctx.db, ctx.user.id))
  ),

  convert: rateLimitedMutationProcedure
    .input(
      z.object({
        direction: z.enum(["CONVERT_IN", "CONVERT_OUT"]),
        amount: z.number().int().min(1).max(1_000_000),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("convert", () => convert(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  listCompanies: protectedProcedure.query(({ ctx }) =>
    guard("list companies", () => listCompanies(ctx.db))
  ),

  foundCompany: rateLimitedMutationProcedure
    .input(
      z.object({
        name: z.string().trim().min(3).max(60),
        sectorKey: z.enum(SECTOR_KEYS),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("found the company", () => foundCompany(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  depositToCompany: rateLimitedMutationProcedure
    .input(z.object({ companyId: z.string().min(1), amount: sovereigns, requestId }))
    .mutation(({ ctx, input }) =>
      guard("deposit", () => depositToCompany(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  withdrawFromCompany: rateLimitedMutationProcedure
    .input(z.object({ companyId: z.string().min(1), amount: sovereigns, requestId }))
    .mutation(({ ctx, input }) =>
      guard("withdraw", () => withdrawFromCompany(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  dissolveCompany: rateLimitedMutationProcedure
    .input(z.object({ companyId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      guard("dissolve the company", () =>
        dissolveCompany(ctx.db, { userId: ctx.user.id, companyId: input.companyId })
      )
    ),

  listContracts: protectedProcedure
    .input(z.object({ scope: z.enum(["open", "mine"]) }))
    .query(({ ctx, input }) =>
      guard("list contracts", () => listContracts(ctx.db, ctx.user.id, input.scope))
    ),

  createContract: rateLimitedMutationProcedure
    .input(
      z.object({
        issuerCompanyId: z.string().min(1),
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).optional(),
        sectorKey: z.enum(SECTOR_KEYS),
        value: z.number().int().min(10).max(10_000_000),
        biddingDays: z.number().int().min(1).max(30),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("post the contract", () => createContract(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  placeBid: rateLimitedMutationProcedure
    .input(
      z.object({ contractId: z.string().min(1), companyId: z.string().min(1), amount: sovereigns })
    )
    .mutation(({ ctx, input }) =>
      guard("place the bid", () => placeBid(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  withdrawBid: rateLimitedMutationProcedure
    .input(z.object({ bidId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      guard("withdraw the bid", () =>
        withdrawBid(ctx.db, { userId: ctx.user.id, bidId: input.bidId })
      )
    ),

  awardContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: z.string().min(1), bidId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      guard("award the contract", () => awardContract(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  completeContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      guard("complete the contract", () =>
        completeContract(ctx.db, { userId: ctx.user.id, contractId: input.contractId })
      )
    ),

  cancelContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      guard("cancel the contract", () =>
        cancelContract(ctx.db, { userId: ctx.user.id, contractId: input.contractId })
      )
    ),

  releaseContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      guard("release the contract", () =>
        releaseContract(ctx.db, { userId: ctx.user.id, contractId: input.contractId })
      )
    ),

  disputeContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: z.string().min(1), reason: z.string().trim().min(5).max(1000) }))
    .mutation(({ ctx, input }) =>
      guard("open the dispute", () => disputeContract(ctx.db, { userId: ctx.user.id, ...input }))
    ),
});

export const exchangeRouter = mergeRouters(exchangeUserRouter, exchangeAdminRouter);
