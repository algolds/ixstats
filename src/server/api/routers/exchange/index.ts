/**
 * Exchange router: the Sovereign (₷) economy. Companies and contracts here; the
 * share market, dividends, sector funds, decisions and tenders in markets.ts;
 * shareholder governance in governance.ts; nation treasuries and credit lines in treasury.ts.
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
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
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
import {
  previewWikiCompany,
  syncCompanyFromWiki,
  toCompanyWikiSlug,
} from "~/lib/exchange/company-wiki";
import { getExchangeOverview, listContracts } from "~/lib/exchange/queries";
import { SUB_INDUSTRY_KEYS } from "~/lib/exchange/taxonomy";
import { canModerateRealm, isSiteAdmin } from "~/server/modules/realms/realms.access";
import { guard } from "./_errors";
import { exchangeAdminRouter } from "./admin";
import { exchangeGovernanceRouter } from "./governance";
import { exchangeMarketsRouter } from "./markets";
import { exchangeTerminalRouter } from "./terminal";
import { exchangeTreasuryRouter } from "./treasury";

const requestId = z.string().min(8).max(64);
const sovereigns = z.number().int().min(1).max(10_000_000);
const id = z.string().min(1);

const exchangeUserRouter = createTRPCRouter({
  /** Wallet, my companies, holdings, buy orders, realms and recent ledger rows. */
  getOverview: protectedProcedure
    .input(z.object({ realmId: id.optional() }).optional())
    .query(({ ctx, input }) =>
      guard("load the Exchange", async () => {
        const realmId = input?.realmId ?? DEFAULT_REALM_ID;
        const [overview, realm] = await Promise.all([
          getExchangeOverview(ctx.db, ctx.user.id, realmId),
          realmId === DEFAULT_REALM_ID
            ? Promise.resolve(null)
            : ctx.db.realm.findUnique({ where: { id: realmId }, select: { ownerId: true } }),
        ]);
        const canManageRealm =
          isSiteAdmin(ctx.user) || (!!realm && canModerateRealm(ctx.user, realm));
        return { ...overview, canManageRealm };
      })
    ),

  listCompanies: protectedProcedure
    .input(z.object({ realmId: id.optional(), limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(({ ctx, input }) =>
      guard("list companies", () => listCompanies(ctx.db, input?.limit ?? 50, input?.realmId))
    ),

  /** Preview company lore, logo, sector/sub-industry, and HQ nation from a WikiOS page. */
  previewWikiCompany: protectedProcedure
    .input(
      z.object({
        wikiTitle: z.string().trim().min(1).max(200),
        realmId: id.optional(),
      })
    )
    .query(({ ctx, input }) =>
      guard("preview the WikiOS company page", () =>
        previewWikiCompany(ctx, input.wikiTitle, input.realmId ?? DEFAULT_REALM_ID)
      )
    ),

  /** Sync an existing company's lore and metadata from a WikiOS article. */
  syncCompanyWiki: rateLimitedMutationProcedure
    .input(
      z.object({
        companyId: id,
        wikiTitle: z.string().trim().min(1).max(200).optional(),
        applyTaxonomyAndHq: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      guard("sync the company from WikiOS", () =>
        syncCompanyFromWiki(ctx, {
          companyId: input.companyId,
          wikiTitle: input.wikiTitle,
          applyTaxonomyAndHq: input.applyTaxonomyAndHq,
          userId: ctx.user.id,
          isAdmin: isSiteAdmin(ctx.user),
        })
      )
    ),

  foundCompany: rateLimitedMutationProcedure
    .input(
      z.object({
        name: z.string().trim().min(3).max(60),
        sectorKey: z.enum(SECTOR_KEYS),
        subIndustryKey: z.enum(SUB_INDUSTRY_KEYS).optional(),
        hqCountryId: id.nullable().optional(),
        wikiSlug: z.string().trim().max(200).nullable().optional(),
        realmId: id.optional(),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("found the company", async () => {
        const cleanSlug = toCompanyWikiSlug(input.wikiSlug);
        let wikiData: Record<string, string | null> | undefined;
        if (cleanSlug) {
          try {
            const preview = await previewWikiCompany(
              ctx,
              cleanSlug,
              input.realmId ?? DEFAULT_REALM_ID
            );
            wikiData = { ...preview.wikiData };
          } catch {
            // If the linked wiki page does not exist yet, still link the slug for future sync.
          }
        }
        return foundCompany(ctx.db, {
          userId: ctx.user.id,
          ...input,
          wikiSlug: cleanSlug,
          wikiData,
        });
      })
    ),

  depositToCompany: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, amount: sovereigns, requestId }))
    .mutation(({ ctx, input }) =>
      guard("deposit", () => depositToCompany(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  withdrawFromCompany: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, amount: sovereigns, requestId }))
    .mutation(({ ctx, input }) =>
      guard("withdraw", () => withdrawFromCompany(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  dissolveCompany: rateLimitedMutationProcedure
    .input(z.object({ companyId: id }))
    .mutation(({ ctx, input }) =>
      guard("dissolve the company", () =>
        dissolveCompany(ctx.db, { userId: ctx.user.id, companyId: input.companyId })
      )
    ),

  listContracts: protectedProcedure
    .input(z.object({ scope: z.enum(["open", "mine"]), realmId: id.optional() }))
    .query(({ ctx, input }) =>
      guard("list contracts", () =>
        listContracts(ctx.db, ctx.user.id, input.scope, input.realmId)
      )
    ),

  createContract: rateLimitedMutationProcedure
    .input(
      z.object({
        issuerCompanyId: id,
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
    .input(z.object({ contractId: id, companyId: id, amount: sovereigns }))
    .mutation(({ ctx, input }) =>
      guard("place the bid", () => placeBid(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  withdrawBid: rateLimitedMutationProcedure
    .input(z.object({ bidId: id }))
    .mutation(({ ctx, input }) =>
      guard("withdraw the bid", () =>
        withdrawBid(ctx.db, { userId: ctx.user.id, bidId: input.bidId })
      )
    ),

  awardContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: id, bidId: id }))
    .mutation(({ ctx, input }) =>
      guard("award the contract", () => awardContract(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  completeContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: id }))
    .mutation(({ ctx, input }) =>
      guard("complete the contract", () =>
        completeContract(ctx.db, { userId: ctx.user.id, contractId: input.contractId })
      )
    ),

  cancelContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: id }))
    .mutation(({ ctx, input }) =>
      guard("cancel the contract", () =>
        cancelContract(ctx.db, { userId: ctx.user.id, contractId: input.contractId })
      )
    ),

  releaseContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: id }))
    .mutation(({ ctx, input }) =>
      guard("release the contract", () =>
        releaseContract(ctx.db, { userId: ctx.user.id, contractId: input.contractId })
      )
    ),

  disputeContract: rateLimitedMutationProcedure
    .input(z.object({ contractId: id, reason: z.string().trim().min(5).max(1000) }))
    .mutation(({ ctx, input }) =>
      guard("open the dispute", () => disputeContract(ctx.db, { userId: ctx.user.id, ...input }))
    ),
});

export const exchangeRouter = mergeRouters(
  exchangeUserRouter,
  exchangeMarketsRouter,
  exchangeGovernanceRouter,
  exchangeTreasuryRouter,
  exchangeAdminRouter,
  exchangeTerminalRouter
);
