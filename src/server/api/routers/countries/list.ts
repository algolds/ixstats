import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { publicProcedure, cachedPublicProcedure, cachedStaticProcedure } from "~/server/api/trpc";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { TRPCError } from "@trpc/server";
import { realmScopeInput, realmWhere, viewerRealmId } from "~/server/api/trpc/realm-scope";

const MAP_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  flag: true,
  continent: true,
  region: true,
  economicTier: true,
  populationTier: true,
  currentPopulation: true,
  currentGdpPerCapita: true,
  currentTotalGdp: true,
  adjustedGdpGrowth: true,
  landArea: true,
  leader: true,
  governmentType: true,
  ownerUserId: true,
  nationalIdentity: { select: { capitalCity: true } },
} satisfies Prisma.CountrySelect;

function mapSummary(c: Prisma.CountryGetPayload<{ select: typeof MAP_SUMMARY_SELECT }>) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    flagUrl: normalizeFlagUrl(c.flag),
    continent: c.continent,
    region: c.region,
    economicTier: c.economicTier,
    populationTier: c.populationTier,
    population: c.currentPopulation,
    gdpPerCapita: c.currentGdpPerCapita,
    totalGdp: c.currentTotalGdp,
    gdpGrowth: c.adjustedGdpGrowth,
    landArea: c.landArea,
    leader: c.leader,
    governmentType: c.governmentType,
    capitalCity: c.nationalIdentity?.capitalCity ?? null,
    /** Whether a player holds the nation (never the owner's id: this is a public read). */
    claimed: c.ownerUserId !== null,
  };
}

export const listProcedures = {
  // Get simple list of countries for dropdowns
  getSelectList: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().optional().default(20),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: {
          ...(await realmWhere(ctx, input.realm)),
          name: input.search ? { contains: input.search, mode: "insensitive" } : undefined,
        },
        take: input.limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          coatOfArms: true,
          economicTier: true,
          continent: true,
          currentPopulation: true,
          currentTotalGdp: true,
        },
      });

      return countries.map((country) => ({
        id: country.id,
        name: country.name,
        slug: country.slug ?? undefined,
        flagUrl: normalizeFlagUrl(country.flag) ?? undefined,
        flag: country.flag, // support flag as string for backward-compatibility on components
        coatOfArmsUrl: country.coatOfArms ?? undefined,
        economicTier: country.economicTier ?? undefined,
        continent: country.continent ?? undefined,
        population: country.currentPopulation ? Number(country.currentPopulation) : undefined,
        gdp: country.currentTotalGdp ? Number(country.currentTotalGdp) : undefined,
      }));
    }),

  // Get all countries with basic info + total count
  getAll: cachedPublicProcedure
    .input(
      z
        .object({
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
          search: z.string().optional(),
          continent: z.string().optional(),
          economicTier: z.string().optional(),
          ...realmScopeInput.shape,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        isDemo: false,
        ...(await realmWhere(ctx, input?.realm)),
      };
      if (input?.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }
      if (input?.continent) {
        where.continent = input.continent;
      }
      if (input?.economicTier) {
        where.economicTier = input.economicTier;
      }

      const [rawCountries, total] = await Promise.all([
        ctx.db.country.findMany({
          where,
          take: input?.limit,
          skip: input?.offset,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            flag: true,
            continent: true,
            region: true,
            governmentType: true,
            leader: true,
            religion: true,
            currentPopulation: true,
            currentGdpPerCapita: true,
            currentTotalGdp: true,
            economicTier: true,
            populationTier: true,
            landArea: true,
            areaSqMi: true,
            populationDensity: true,
            gdpDensity: true,
            adjustedGdpGrowth: true,
            populationGrowthRate: true,
            lifeExpectancy: true,
            literacyRate: true,
            unemploymentRate: true,
            inflationRate: true,
            povertyRate: true,
            totalDebtGDPRatio: true,
            realGDPGrowthRate: true,
            wikiPageTitle: true,
            wikiSource: true,
            wikiLastSynced: true,
            centroid: true,
            boundingBox: true,
            nationalIdentity: {
              select: {
                officialName: true,
                capitalCity: true,
                currency: true,
              },
            },
          },
        }),
        ctx.db.country.count({ where }),
      ]);

      const countries = rawCountries.map((country) => {
        const boundingBox = country.boundingBox as
          | [number, number, number, number]
          | { minLat?: number; minLng?: number; maxLat?: number; maxLng?: number }
          | null
          | undefined;

        const bounds =
          Array.isArray(boundingBox) && boundingBox.length === 4
            ? {
                minLat: boundingBox[0],
                minLng: boundingBox[1],
                maxLat: boundingBox[2],
                maxLng: boundingBox[3],
              }
            : typeof boundingBox === "object" &&
                boundingBox !== null &&
                "minLng" in boundingBox &&
                boundingBox.minLng !== undefined
              ? {
                  minLat: boundingBox.minLat,
                  minLng: boundingBox.minLng,
                  maxLat: boundingBox.maxLat,
                  maxLng: boundingBox.maxLng,
                }
              : {};

        const centroid = country.centroid as { coordinates?: number[] } | null | undefined;

        const centerCoords =
          centroid?.coordinates &&
          Array.isArray(centroid.coordinates) &&
          centroid.coordinates.length === 2
            ? {
                centerLng: centroid.coordinates[0],
                centerLat: centroid.coordinates[1],
              }
            : {};

        return {
          ...country,
          flagUrl: normalizeFlagUrl(country.flag),
          ...bounds,
          ...centerCoords,
          calculatedStats: {
            gdpGrowth: country.adjustedGdpGrowth || 0,
            populationGrowth: country.populationGrowthRate || 0,
            inflation: country.inflationRate || 0.02,
          },
          analytics: {
            growthTrends: {
              avgPopGrowth: country.populationGrowthRate || 0,
              avgGdpGrowth: country.adjustedGdpGrowth || 0,
            },
            riskFlags: [] as string[],
            tierChangeProjection: {
              year: new Date().getFullYear(),
              newTier: country.economicTier ?? "Unknown",
            },
          },
        };
      });

      return { countries, total };
    }),

  /**
   * Lightweight summary for map info panel (no calculator overhead)
   */
  getMapSummary: cachedStaticProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const c = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: MAP_SUMMARY_SELECT,
      });
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      return mapSummary(c);
    }),

  /**
   * Bulk map summaries — single DB query for all country stats.
   * Used by MapPrefetcher for upfront warming instead of staggered individual calls.
   */
  getBulkMapSummaries: cachedStaticProcedure
    .input(z.object({ countryIds: z.array(z.string()).max(200) }))
    .query(async ({ ctx, input }) => {
      const ids = input.countryIds.filter(Boolean);
      const countries =
        ids.length === 0
          ? []
          : await ctx.db.country.findMany({
              where: { id: { in: ids } },
              select: MAP_SUMMARY_SELECT,
            });
      return Object.fromEntries(countries.map((c) => [c.id, mapSummary(c)]));
    }),

  /**
   * Top countries by composite importance (population × GDP per capita).
   * Used by the world map to highlight prominent nations.
   */
  getTopCountriesByImportance: cachedStaticProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(25), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false, realmId: await viewerRealmId(ctx, input.realm) },
        orderBy: [{ currentPopulation: "desc" }, { currentGdpPerCapita: "desc" }],
        take: input.limit,
        select: { name: true, currentPopulation: true, currentGdpPerCapita: true },
      });

      // Sort by composite importance score (population × GDP per capita)
      const scored = countries.map((c) => ({
        name: c.name,
        score: (c.currentPopulation ?? 0) * (c.currentGdpPerCapita ?? 0),
      }));
      scored.sort((a, b) => b.score - a.score);

      return scored.map((c) => c.name);
    }),

  getTopCountriesByPopulation: cachedPublicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false, realmId: await viewerRealmId(ctx, input.realm) },
        orderBy: { currentPopulation: "desc" },
        take: input.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          currentPopulation: true,
          populationTier: true,
        },
      });

      return countries.map((c) => ({
        ...c,
        flagUrl: normalizeFlagUrl(c.flag),
      }));
    }),

  /**
   * Get random countries (for "Countries to Explore" widget).
   * No caching — each call returns a fresh random selection.
   */
  getRandomCountries: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(10).default(3),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const where = { isDemo: false, realmId: await viewerRealmId(ctx, input.realm) };
      const count = await ctx.db.country.count({ where });
      const skip = Math.max(0, Math.floor(Math.random() * count) - input.limit);

      const countries = await ctx.db.country.findMany({
        where,
        take: input.limit,
        skip,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          economicTier: true,
          currentPopulation: true,
          continent: true,
          region: true,
        },
      });

      // Shuffle for true randomness (the skip-based approach is pseudo-random)
      const shuffled = countries.sort(() => Math.random() - 0.5);

      return shuffled.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        flagUrl: normalizeFlagUrl(c.flag),
        economicTier: c.economicTier,
        currentPopulation: c.currentPopulation,
        continent: c.continent,
        region: c.region,
      }));
    }),
};
