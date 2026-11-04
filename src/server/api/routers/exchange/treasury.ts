/**
 * Exchange treasury and credit procedures: nation ₷ treasuries, domiciled corporate summaries,
 * B2G treasury/faucet tenders, and Central Bank credit line draws and repayments.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { getExchangeConfig } from "~/lib/vault/exchange-config";
import { round2 } from "~/lib/exchange/amounts";
import { SECTOR_KEYS } from "~/lib/exchange/companies";
import {
  createFaucetTender,
  createGovernmentContract,
  TENDER_FUNDINGS,
} from "~/lib/exchange/contracts";
import { borrowCredit, creditLimitFor, repayCredit } from "~/lib/exchange/credit";
import { macroOfCountry } from "~/lib/exchange/tariffs";
import { stipendFor, treasurySummary } from "~/lib/exchange/treasury";
import { canModerateRealm, isSiteAdmin } from "~/server/modules/realms/realms.access";
import { guard } from "./_errors";

const id = z.string().min(1);
const requestId = z.string().min(8).max(64);
const creditAmount = z.number().min(0.01).max(250_000).multipleOf(0.01);

export const exchangeTreasuryRouter = createTRPCRouter({
  /** Nation ₷ treasury balance, lifetime counters, stipend rate and recent ledger entries. */
  getTreasury: protectedProcedure.input(z.object({ countryId: id })).query(({ ctx, input }) =>
    guard("load the nation treasury", async () => {
      const [cfg, country] = await Promise.all([
        getExchangeConfig(ctx.db),
        ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { economicTier: true },
        }),
      ]);
      const summary = await treasurySummary(ctx.db, input.countryId, cfg.treasuryCap);
      const dailyStipend = stipendFor(
        country?.economicTier ?? "Developed",
        cfg.treasuryDailyStipend
      );
      return { ...summary, dailyStipend };
    })
  ),

  /** Domiciled companies, aggregate corporate metrics, tax competitiveness and open B2G tenders for a nation. */
  getRealmCorporateSummary: protectedProcedure
    .input(z.object({ countryId: id }))
    .query(({ ctx, input }) =>
      guard("load the corporate summary", async () => {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true, realmId: true, economicTier: true },
        });
        const realmId = country?.realmId ?? DEFAULT_REALM_ID;
        const [companies, treasury, macro, realmCountries, openTenders] = await Promise.all([
          ctx.db.company.findMany({
            where: {
              hqCountryId: input.countryId,
              status: { in: ["ACTIVE", "DISTRESSED"] },
            },
            orderBy: [{ fairValue: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              sectorKey: true,
              subIndustryKey: true,
              status: true,
              fairValue: true,
              capital: true,
              standing: true,
              decisionValue: true,
              contractsWonValue: true,
              creditDrawn: true,
              creditRating: true,
              lastTickRevenue: true,
              lastTickExpenses: true,
              lastTickTax: true,
              lastTickNetIncome: true,
              distressedSinceIxTime: true,
              founderId: true,
            },
          }),
          ctx.db.nationTreasury.findUnique({
            where: { countryId: input.countryId },
            select: { balance: true, corporateGdpShift: true },
          }),
          macroOfCountry(ctx.db, input.countryId),
          ctx.db.country.findMany({
            where: { realmId },
            select: { id: true },
            take: 60,
          }),
          ctx.db.contract.findMany({
            where: {
              issuerCountryId: input.countryId,
              status: { in: ["OPEN", "AWARDED"] },
            },
            orderBy: { createdAt: "desc" },
            take: 25,
            select: {
              id: true,
              title: true,
              sectorKey: true,
              value: true,
              fundedBy: true,
              status: true,
              endIxTime: true,
              linkedDirectiveId: true,
              linkedIssueId: true,
              bids: { select: { id: true, amount: true } },
            },
          }),
        ]);

        const sampleMacros = await Promise.all(
          realmCountries.slice(0, 20).map((c) => macroOfCountry(ctx.db, c.id))
        );
        const validMacros = sampleMacros.filter((m): m is NonNullable<typeof m> => m !== null);
        const realmAvgCorpTaxRate =
          validMacros.length > 0
            ? round2(
                validMacros.reduce((s, m) => s + m.corporateTaxRate, 0) / validMacros.length
              )
            : (macro?.corporateTaxRate ?? 0.2);

        const enriched = companies.map((c) => ({
          ...c,
          creditLimit: round2(creditLimitFor(c)),
        }));

        return {
          countryId: input.countryId,
          realmId,
          companies: enriched,
          totals: {
            companyCount: enriched.length,
            distressedCount: enriched.filter((c) => c.status === "DISTRESSED").length,
            totalFairValue: round2(enriched.reduce((s, c) => s + c.fairValue, 0)),
            totalCapital: round2(enriched.reduce((s, c) => s + c.capital, 0)),
            totalCreditDrawn: round2(enriched.reduce((s, c) => s + c.creditDrawn, 0)),
            lastTickRevenue: round2(enriched.reduce((s, c) => s + c.lastTickRevenue, 0)),
            lastTickTax: round2(enriched.reduce((s, c) => s + c.lastTickTax, 0)),
            lastTickNetIncome: round2(enriched.reduce((s, c) => s + c.lastTickNetIncome, 0)),
          },
          corporateGdpShift: treasury?.corporateGdpShift ?? 0,
          taxCompetitiveness: {
            effectiveCorpTaxRate: macro?.corporateTaxRate ?? 0.2,
            capGainsTaxRate: macro?.capGainsTaxRate ?? 0.15,
            interestRate: macro?.interestRate ?? 0.05,
            realmAvgCorpTaxRate,
          },
          openTenders: openTenders.map((t) => ({
            id: t.id,
            title: t.title,
            sectorKey: t.sectorKey,
            value: t.value,
            fundedBy: t.fundedBy,
            status: t.status,
            endIxTime: t.endIxTime,
            linkedDirectiveId: t.linkedDirectiveId,
            linkedIssueId: t.linkedIssueId,
            bidCount: t.bids.length,
            lowestBid: t.bids.length > 0 ? Math.min(...t.bids.map((b) => b.amount)) : null,
          })),
        };
      })
    ),

  /** Issue a B2G tender funded by the nation's ₷ treasury or the owner's wallet. */
  createTreasuryTender: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: id,
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).optional(),
        sectorKey: z.enum(SECTOR_KEYS),
        value: z.number().int().min(10).max(10_000_000),
        biddingDays: z.number().int().min(1).max(30),
        fundedBy: z.enum(TENDER_FUNDINGS).default("TREASURY"),
        linkedDirectiveId: id.optional(),
        linkedIssueId: id.optional(),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("post the treasury tender", () =>
        createGovernmentContract(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),

  /** Issue a DM faucet tender in a realm, subject to the realm's weekly faucet cap. */
  createFaucetTender: rateLimitedMutationProcedure
    .input(
      z.object({
        realmId: id.default(DEFAULT_REALM_ID),
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).optional(),
        sectorKey: z.enum(SECTOR_KEYS),
        value: z.number().int().min(10).max(10_000_000),
        biddingDays: z.number().int().min(1).max(30),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("post the faucet tender", async () => {
        const realm = await ctx.db.realm.findUnique({
          where: { id: input.realmId },
          select: { ownerId: true },
        });
        const permitted =
          isSiteAdmin(ctx.user) || (!!realm && canModerateRealm(ctx.user, realm));
        return createFaucetTender(ctx.db, {
          userId: ctx.user.id,
          permitted,
          ...input,
        });
      })
    ),

  /** Draw on a company's Central Bank credit line from its HQ nation's treasury. */
  borrowCredit: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, amount: creditAmount, requestId }))
    .mutation(({ ctx, input }) =>
      guard("draw on the credit line", () =>
        borrowCredit(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),

  /** Repay a company's Central Bank credit line to its HQ nation's treasury. */
  repayCredit: rateLimitedMutationProcedure
    .input(z.object({ companyId: id, amount: creditAmount, requestId }))
    .mutation(({ ctx, input }) =>
      guard("repay the credit line", () =>
        repayCredit(ctx.db, { userId: ctx.user.id, ...input })
      )
    ),
});

