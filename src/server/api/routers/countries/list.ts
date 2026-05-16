import { z } from "zod";
import { publicProcedure, cachedPublicProcedure, cachedStaticProcedure } from "~/server/api/trpc";
import { normalizeFlagUrl } from "~/lib/unified-flag-service";
import { TRPCError } from "@trpc/server";

export const listProcedures = {
  // Get simple list of countries for dropdowns
  getSelectList: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().optional().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: input.search
          ? {
              name: {
                contains: input.search,
                mode: "insensitive",
              },
            }
          : undefined,
        take: input.limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          coatOfArms: true,
          economicTier: true,
        },
      });

      return countries.map((country) => ({
        id: country.id,
        name: country.name,
        slug: country.slug ?? undefined,
        flagUrl: normalizeFlagUrl(country.flag),
        coatOfArmsUrl: country.coatOfArms ?? undefined,
        economicTier: country.economicTier ?? undefined,
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
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isDemo: false };
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
            centroid: true,
            boundingBox: true,
            nationalIdentity: {
              select: {
                officialName: true,
                capitalCity: true,
                currency: true,
              }
            }
          },
        }),
        ctx.db.country.count({ where }),
      ]);

      const countries = rawCountries.map((country: any) => {
        const boundingBox = country.boundingBox as any;
        const bounds = boundingBox && Array.isArray(boundingBox) && boundingBox.length === 4
          ? {
              minLat: boundingBox[0],
              minLng: boundingBox[1],
              maxLat: boundingBox[2],
              maxLng: boundingBox[3],
            }
          : boundingBox?.minLng !== undefined
          ? {
              minLat: boundingBox.minLat,
              minLng: boundingBox.minLng,
              maxLat: boundingBox.maxLat,
              maxLng: boundingBox.maxLng,
            }
          : {};

        const centroid = country.centroid as any;
        const centerCoords = centroid?.coordinates && Array.isArray(centroid.coordinates) && centroid.coordinates.length === 2
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
            riskFlags: [],
            tierChangeProjection: { year: new Date().getFullYear(), newTier: country.economicTier },
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
        select: {
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
        },
      });
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
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
      };
    }),

  /**
   * Bulk map summaries — single DB query for all country stats.
   * Used by MapPrefetcher for upfront warming instead of staggered individual calls.
   */
  getBulkMapSummaries: cachedStaticProcedure
    .input(z.object({ countryIds: z.array(z.string()).max(200) }))
    .query(async ({ ctx, input }) => {
      const ids = input.countryIds.filter(Boolean);
      if (ids.length === 0) return {};
      const countries = await ctx.db.country.findMany({
        where: { id: { in: ids } },
        select: {
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
        },
      });
      const result: Record<string, any> = {};
      for (const c of countries) {
        result[c.id] = {
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
        };
      }
      return result;
    }),

  /**
   * Top countries by composite importance (population × GDP per capita).
   * Used by the world map to highlight prominent nations.
   */
  getTopCountriesByImportance: cachedStaticProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false },
        orderBy: [
          { currentPopulation: "desc" },
          { currentGdpPerCapita: "desc" },
        ],
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

  getTopCountriesByGdpPerCapita: cachedPublicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false },
        orderBy: { currentGdpPerCapita: "desc" },
        take: input.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          currentGdpPerCapita: true,
          economicTier: true,
        },
      });

      return countries.map((c) => ({
        ...c,
        flagUrl: normalizeFlagUrl(c.flag),
      }));
    }),

  getTopCountriesByPopulation: cachedPublicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { isDemo: false },
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
};
