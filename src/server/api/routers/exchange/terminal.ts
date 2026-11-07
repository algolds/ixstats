/**
 * The Exchange terminal (docs/specs/2026-11-06-exchange-overhaul-design.md): public reads for the front page, markets
 * and object pages, the signed-in portfolio and watchlist, and nation bonds. Thin: every rule lives in
 * src/lib/exchange (terminal.ts, bonds.ts, news.ts).
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { ExchangeError } from "~/lib/vault/exchange-service";
import {
  BOND_FACE,
  BOND_UNITS_MAX,
  BOND_UNITS_MIN,
  COUPON_MAX,
  COUPON_MIN,
  TERM_WEEKS_MAX,
  TERM_WEEKS_MIN,
  buyBondListing,
  buyBondPrimary,
  cancelBondListing,
  issueBond,
  listBondUnits,
} from "~/lib/exchange/bonds";
import { MARKET_KINDS } from "~/lib/exchange/routes";
import {
  getBondPage,
  getCompanyPage,
  getFrontPage,
  getLeaderboards,
  getMarkets,
  getNationPage,
  getPortfolio,
  getStory,
} from "~/lib/exchange/terminal";
import { listNews } from "~/lib/exchange/news";
import { listOpenRealms } from "~/lib/exchange/queries";
import { guard } from "./_errors";

const id = z.string().min(1).max(64);
const requestId = z.string().min(8).max(64);
const realm = z.object({ realmId: id.optional() });
const realmOf = (input: { realmId?: string }) => input.realmId ?? DEFAULT_REALM_ID;
const units = z.number().int().min(1).max(BOND_UNITS_MAX);
const WATCH_KINDS = ["COMPANY", "BOND", "NATION"] as const;

function found<T>(value: T | null, what: string): T {
  if (value === null) throw new ExchangeError("NOT_FOUND", `${what} not found`);
  return value;
}

export const exchangeTerminalRouter = createTRPCRouter({
  /** The realms whose markets can be watched, Ixnay first. */
  realms: publicProcedure.query(({ ctx }) =>
    guard("list the realms", () => listOpenRealms(ctx.db))
  ),

  frontPage: publicProcedure
    .input(realm)
    .query(({ ctx, input }) =>
      guard("load the front page", () => getFrontPage(ctx.db, realmOf(input)))
    ),

  markets: publicProcedure
    .input(
      realm.extend({ kind: z.enum(MARKET_KINDS), query: z.string().trim().max(80).optional() })
    )
    .query(({ ctx, input }) =>
      guard("load the markets", () =>
        getMarkets(ctx.db, realmOf(input), input.kind, input.query || undefined)
      )
    ),

  companyPage: publicProcedure
    .input(z.object({ companyId: id }))
    .query(({ ctx, input }) =>
      guard("load the company", async () =>
        found(await getCompanyPage(ctx.db, input.companyId, ctx.user?.id ?? null), "Company")
      )
    ),

  bondPage: publicProcedure
    .input(z.object({ bondId: id }))
    .query(({ ctx, input }) =>
      guard("load the bond", async () =>
        found(await getBondPage(ctx.db, input.bondId, ctx.user?.id ?? null), "Bond")
      )
    ),

  nationPage: publicProcedure
    .input(z.object({ countryId: id }))
    .query(({ ctx, input }) =>
      guard("load the nation", async () =>
        found(await getNationPage(ctx.db, input.countryId, ctx.user?.id ?? null), "Nation")
      )
    ),

  story: publicProcedure
    .input(z.object({ newsId: id }))
    .query(({ ctx, input }) =>
      guard("load the story", async () => found(await getStory(ctx.db, input.newsId), "Story"))
    ),

  news: publicProcedure
    .input(realm.extend({ before: z.date().optional() }))
    .query(({ ctx, input }) =>
      guard("load the news", () =>
        listNews(ctx.db, {
          realmId: realmOf(input),
          prominence: "HEADLINE",
          take: 30,
          before: input.before,
        })
      )
    ),

  leaderboards: publicProcedure
    .input(realm)
    .query(({ ctx, input }) =>
      guard("load the leaderboards", () => getLeaderboards(ctx.db, realmOf(input)))
    ),

  portfolio: protectedProcedure
    .input(realm)
    .query(({ ctx, input }) =>
      guard("load your portfolio", () => getPortfolio(ctx.db, ctx.user.id, realmOf(input)))
    ),

  toggleWatch: rateLimitedMutationProcedure
    .input(z.object({ subjectKind: z.enum(WATCH_KINDS), subjectId: id }))
    .mutation(({ ctx, input }) =>
      guard("update your watchlist", async () => {
        const where = {
          userId: ctx.user.id,
          subjectKind: input.subjectKind,
          subjectId: input.subjectId,
        };
        const existing = await ctx.db.exchangeWatch.findFirst({ where, select: { id: true } });
        if (existing) {
          await ctx.db.exchangeWatch.delete({ where: { id: existing.id } });
          return { watching: false };
        }
        await ctx.db.exchangeWatch.createMany({ data: [where], skipDuplicates: true });
        return { watching: true };
      })
    ),

  issueBond: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: id,
        units: z.number().int().min(BOND_UNITS_MIN).max(BOND_UNITS_MAX),
        couponRate: z.number().min(COUPON_MIN).max(COUPON_MAX),
        termWeeks: z.number().int().min(TERM_WEEKS_MIN).max(TERM_WEEKS_MAX),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("issue the bonds", () => issueBond(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  buyBondPrimary: rateLimitedMutationProcedure
    .input(z.object({ bondId: id, units, requestId }))
    .mutation(({ ctx, input }) =>
      guard("buy the bonds", () => buyBondPrimary(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  listBondUnits: rateLimitedMutationProcedure
    .input(
      z.object({
        bondId: id,
        units,
        pricePerUnit: z
          .number()
          .min(0.01)
          .max(BOND_FACE * 10)
          .multipleOf(0.01),
        requestId,
      })
    )
    .mutation(({ ctx, input }) =>
      guard("list the bonds", () => listBondUnits(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  buyBondListing: rateLimitedMutationProcedure
    .input(z.object({ listingId: id, units, requestId }))
    .mutation(({ ctx, input }) =>
      guard("buy the bonds", () => buyBondListing(ctx.db, { userId: ctx.user.id, ...input }))
    ),

  cancelBondListing: rateLimitedMutationProcedure
    .input(z.object({ listingId: id }))
    .mutation(({ ctx, input }) =>
      guard("cancel the listing", () =>
        cancelBondListing(ctx.db, { userId: ctx.user.id, listingId: input.listingId })
      )
    ),
});
