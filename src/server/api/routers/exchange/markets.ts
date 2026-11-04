/**
 * Exchange market procedures: the share market, two-sided order book and dividends,
 * sector indices and funds, company strategic decisions and government tenders.
 * Every mutation is rate limited per procedure, acts as the signed-in user and checks the
 * Exchange flag inside its transaction; money-moving ones take a client `requestId`.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { SECTOR_KEYS } from "~/lib/exchange/companies";
import { createGovernmentContract, TENDER_FUNDINGS } from "~/lib/exchange/contracts";
import {
  ACQUIRE_MAX,
  ACQUIRE_MIN,
  DECISION_TYPES,
  EXPAND_MAX,
  LOBBY_TARGETS,
  PRICING_STRATEGIES,
  RND_FOCI,
  listDecisions,
  submitDecision,
} from "~/lib/exchange/decisions";
import { declareDividend, listDividends } from "~/lib/exchange/dividends";
import { listShareMarket } from "~/lib/exchange/queries";
import {
  buySectorUnits,
  getSectorMarket,
  sellSectorUnits,
  setSectorDmModifier,
} from "~/lib/exchange/sectors";
import {
  MAX_SHARES_ISSUED,
  buyShares,
  cancelBuyOrder,
  cancelListing,
  getOrderBook,
  issueShares,
  listShares,
  placeBuyOrder,
  setShareTrading,
} from "~/lib/exchange/shares";
import { SUB_INDUSTRY_KEYS } from "~/lib/exchange/taxonomy";
import { canModerateRealm, isSiteAdmin } from "~/server/modules/realms/realms.access";
import { guard } from "./_errors";

const requestId = z.string().min(8).max(64);
const id = z.string().min(1);
const shares = z.number().int().min(1).max(MAX_SHARES_ISSUED);
const price = z.number().min(0.01).max(1_000_000).multipleOf(0.01);

export const exchangeMarketsRouter = createTRPCRouter({
  /** Open share listings in a realm, cheapest first. */
  getShareMarket: protectedProcedure
    .input(z.object({ realmId: id.optional() }).optional())
    .query(({ ctx, input }) =>
      guard("load the share market", () =>
        listShareMarket(ctx.db, ctx.user.id, input?.realmId ?? DEFAULT_REALM_ID)
      )
    ),

  /** Aggregated bid/ask depth and last traded price for a company. */
  getOrderBook: protectedProcedure.input(z.object({ companyId: id })).query(({ ctx, input }) =>
    guard("load the order book", () => getOrderBook(ctx.db, input.companyId))
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
        pricePerShare: price,
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

  placeBuyOrder: rateLimitedMutationProcedure
    .input(
      z.object({
        companyId: id,
        shares,
        maxPricePerShare: price,
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("place the buy order", () =>
        placeBuyOrder(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),

  cancelBuyOrder: rateLimitedMutationProcedure
    .input(z.object({ orderId: id }))
    .mutation(({ ctx, input }) =>
      guard("cancel the buy order", () =>
        cancelBuyOrder(ctx.db, { userId: ctx.user.id, orderId: input.orderId })
      )
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
        amount: z.number().int().min(1).max(EXPAND_MAX).optional(),
        focus: z.enum(RND_FOCI).optional(),
        sectorKey: z.enum(SECTOR_KEYS).optional(),
        subIndustryKey: z.enum(SUB_INDUSTRY_KEYS).optional(),
        target: z.enum(LOBBY_TARGETS).optional(),
        strategy: z.enum(PRICING_STRATEGIES).optional(),
        targetCompanyId: id.optional(),
        offerAmount: z.number().int().min(ACQUIRE_MIN).max(ACQUIRE_MAX).optional(),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("queue the decision", () => submitDecision(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  /** Sector indices with history, fund unit prices and my positions for a realm. */
  getSectors: protectedProcedure
    .input(z.object({ realmId: id.optional() }).optional())
    .query(({ ctx, input }) =>
      guard("load the sectors", () =>
        getSectorMarket(ctx.db, ctx.user.id, input?.realmId ?? DEFAULT_REALM_ID)
      )
    ),

  buySectorUnits: rateLimitedMutationProcedure
    .input(
      z.object({
        realmId: id.default(DEFAULT_REALM_ID),
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
        realmId: id.default(DEFAULT_REALM_ID),
        sectorKey: z.enum(SECTOR_KEYS),
        fraction: z.number().gt(0).max(1),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("sell fund units", () => sellSectorUnits(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  /** Adjust a sector's DM modifier in a realm the caller moderates or administers. */
  setSectorDmModifier: rateLimitedMutationProcedure
    .input(
      z.object({
        realmId: id.default(DEFAULT_REALM_ID),
        sectorKey: z.enum(SECTOR_KEYS),
        value: z.number().min(-0.5).max(2),
      })
    )
    .mutation(({ ctx, input }) =>
      guard("set the sector modifier", async () => {
        const realm = await ctx.db.realm.findUnique({
          where: { id: input.realmId },
          select: { ownerId: true },
        });
        const permitted =
          isSiteAdmin(ctx.user) || (!!realm && canModerateRealm(ctx.user, realm));
        if (!permitted) {
          throw new ExchangeError(
            "FORBIDDEN",
            "Only a realm's administrators can adjust its sector modifier"
          );
        }
        return setSectorDmModifier(ctx.db, {
          realmId: input.realmId,
          sectorKey: input.sectorKey,
          value: input.value,
          actorUserId: ctx.user.id,
        });
      })
    ),

  /** Post a government tender for a nation you own, funded from its treasury or your wallet. */
  createTender: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: id,
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).optional(),
        sectorKey: z.enum(SECTOR_KEYS),
        value: z.number().int().min(10).max(10_000_000),
        biddingDays: z.number().int().min(1).max(30),
        fundedBy: z.enum(TENDER_FUNDINGS).optional(),
        linkedDirectiveId: id.optional(),
        linkedIssueId: id.optional(),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("post the tender", () =>
        createGovernmentContract(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),
});
