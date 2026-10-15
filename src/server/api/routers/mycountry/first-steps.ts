/**
 * After founding: the welcome page's nation summary and MyCountry's "First steps" checklist.
 * Both read the caller's active nation unless a `countryId` they may write is named.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import {
  FIRST_STEP_IDS,
  changedAfter,
  foundedAt,
  hasMapCoordinates,
  isFoundedRecently,
  writtenAfter,
  type FirstStepId,
  type FirstSteps,
} from "~/lib/mycountry/first-steps";
import {
  MYCOUNTRY_BUDGET_PATH,
  MYCOUNTRY_CABINET_PATH,
  MYCOUNTRY_MAP_EDITOR_PATH,
  MYCOUNTRY_TAX_PATH,
} from "~/lib/mycountry/routes";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { pageEditHref } from "~/lib/wiki-os/page-tools";

const countryInput = z.object({ countryId: z.string().min(1).optional() }).optional();

interface CallerContext {
  user?: { countryId?: string | null } | null;
}

/**
 * The nation a call is about: the named one after a write-access check, else the caller's active
 * nation (null when they have none).
 */
async function resolveCountryId(
  ctx: CallerContext & Parameters<typeof assertCountryWriteAccess>[0],
  countryId: string | undefined
): Promise<string | null> {
  if (countryId) {
    await assertCountryWriteAccess(ctx, countryId);
    return countryId;
  }
  return ctx.user?.countryId ?? null;
}

export const myCountryFirstStepsRouter = createTRPCRouter({
  /**
   * The welcome page's summary of the caller's active nation: identity art, name and the facts
   * line. Null when the caller has no nation yet.
   */
  getWelcome: protectedProcedure.input(countryInput).query(async ({ ctx, input }) => {
    const countryId = await resolveCountryId(ctx, input?.countryId);
    if (!countryId) return null;

    const country = await ctx.db.country.findUnique({
      where: { id: countryId },
      select: {
        id: true,
        name: true,
        slug: true,
        flag: true,
        currentPopulation: true,
        realm: { select: { name: true } },
        nationalIdentity: {
          select: { capitalCity: true, capitalCityRef: { select: { name: true } } },
        },
        cities: {
          where: { isNationalCapital: true, status: { not: "rejected" } },
          select: { name: true },
          take: 1,
        },
      },
    });
    if (!country) return null;

    const capital =
      country.cities[0]?.name ??
      country.nationalIdentity?.capitalCityRef?.name ??
      country.nationalIdentity?.capitalCity?.trim() ??
      null;

    return {
      id: country.id,
      name: country.name,
      slug: country.slug,
      flag: country.flag,
      realmName: country.realm?.name ?? null,
      population: Number.isFinite(country.currentPopulation) ? country.currentPopulation : null,
      capital: capital || null,
    };
  }),

  /**
   * Which first steps the nation has taken, each judged from the rows its console writes. Rows
   * founding itself wrote do not count (see `FOUNDING_GRACE_MS`).
   */
  getFirstSteps: protectedProcedure
    .input(countryInput)
    .query(async ({ ctx, input }): Promise<FirstSteps | null> => {
      const countryId = await resolveCountryId(ctx, input?.countryId);
      if (!countryId) return null;

      const country = await ctx.db.country.findUnique({
        where: { id: countryId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          ownedSince: true,
          wikiPageTitle: true,
          wikiSource: true,
          firstStepsDismissedAt: true,
        },
      });
      if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });

      const founded = foundedAt(country);
      const dismissed = country.firstStepsDismissedAt != null;
      const recent = isFoundedRecently(founded);
      // The card will not show, so there is nothing to look up.
      if (dismissed || !recent) return { countryId, dismissed, recent, items: [] };

      const after = changedAfter(founded);
      const linkedTitle = country.wikiPageTitle?.trim() || null;
      // A named page lives on the nation's wiki; a page under the nation's name is looked for on IxWiki.
      const pageWiki = linkedTitle ? parseWikiSource(country.wikiSource) : "ixwiki";
      const ownTitle = canonicalizeTitle(linkedTitle ?? country.name, { source: pageWiki });

      const [budgetChange, fiscal, tax, officials, wikiArticle, capital] = await Promise.all([
        ctx.db.budgetAllocation.findFirst({
          where: { governmentStructure: { countryId }, updatedAt: { gt: after } },
          select: { id: true },
        }),
        ctx.db.fiscalSystem.findUnique({ where: { countryId }, select: { updatedAt: true } }),
        ctx.db.taxSystem.findUnique({ where: { countryId }, select: { updatedAt: true } }),
        ctx.db.governmentOfficial.count({
          where: {
            isActive: true,
            OR: [
              { governmentStructure: { countryId } },
              { department: { governmentStructure: { countryId } } },
            ],
          },
        }),
        // A page named on the nation is its page; otherwise look for one under the nation's name.
        linkedTitle || !ownTitle
          ? null
          : ctx.db.wikiArticle.findFirst({
              where: { source: "ixwiki", title: ownTitle.title, status: { not: "ARCHIVED" } },
              select: { id: true },
            }),
        ctx.db.city.findFirst({
          where: { countryId, isNationalCapital: true, status: { not: "rejected" } },
          select: { coordinates: true },
        }),
      ]);

      const wikiDone = linkedTitle != null || wikiArticle != null;
      const pageTitle = ownTitle?.title ?? linkedTitle ?? country.name;
      const done: Record<FirstStepId, boolean> = {
        budget: budgetChange != null,
        tax: writtenAfter(fiscal?.updatedAt, after) || writtenAfter(tax?.updatedAt, after),
        cabinet: officials > 0,
        wiki: wikiDone,
        capital: capital != null && hasMapCoordinates(capital.coordinates),
      };
      const href: Record<FirstStepId, string> = {
        budget: MYCOUNTRY_BUDGET_PATH,
        tax: MYCOUNTRY_TAX_PATH,
        cabinet: MYCOUNTRY_CABINET_PATH,
        // Read the page once it exists; until then open the editor to start it.
        wiki: wikiDone ? wikiReaderPath(pageTitle, pageWiki) : pageEditHref(pageTitle),
        capital: MYCOUNTRY_MAP_EDITOR_PATH,
      };

      return {
        countryId,
        dismissed,
        recent,
        items: FIRST_STEP_IDS.map((id) => ({
          id,
          done: done[id],
          href: href[id],
        })),
      };
    }),

  /** Hide the "First steps" card for this nation, for everyone who runs it. */
  dismissFirstSteps: rateLimitedMutationProcedure
    .input(countryInput)
    .mutation(async ({ ctx, input }) => {
      const countryId = await resolveCountryId(ctx, input?.countryId);
      if (!countryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have no nation to hide this for",
        });
      }
      const country = await ctx.db.country.findUnique({
        where: { id: countryId },
        select: { updatedAt: true, firstStepsDismissedAt: true },
      });
      if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      if (country.firstStepsDismissedAt) return { dismissed: true };

      await ctx.db.country.update({
        where: { id: countryId },
        // Keep `updatedAt`: hiding a card is not an edit to the nation.
        data: { firstStepsDismissedAt: new Date(), updatedAt: country.updatedAt },
      });
      return { dismissed: true };
    }),
});
